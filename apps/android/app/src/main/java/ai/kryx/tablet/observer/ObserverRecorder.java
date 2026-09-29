package ai.kryx.tablet.observer;

import android.content.Context;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;

import ai.kryx.tablet.net.ApiClient;
import ai.kryx.tablet.security.AllowedAppsStore;
import ai.kryx.tablet.security.SecureStore;

import org.json.JSONArray;
import org.json.JSONObject;

import java.time.Instant;
import java.util.HashSet;
import java.util.Set;

public final class ObserverRecorder {
    private static final int MAX_LOCAL_EVENTS = 80;
    private static final long MIN_EVENT_GAP_MS = 900L;

    private static String lastKey = "";
    private static long lastAt = 0L;

    private ObserverRecorder() {}

    public static synchronized void record(
        Context context,
        AccessibilityEvent event
    ) {
        if (event == null || event.getPackageName() == null) return;

        try {
            SecureStore secure = new SecureStore(context);
            JSONObject state = secure.readState();
            if (!state.optBoolean("observerEnabled", false)) return;

            String appId = event.getPackageName().toString();
            AllowedAppsStore allowedApps = new AllowedAppsStore(context);
            if (!allowedApps.isAllowed(appId)) return;

            Set<String> excluded = jsonSet(state.optJSONArray("observerExcludedApps"));
            if (excluded.contains(appId)) return;

            String eventType = eventType(event.getEventType());
            if (eventType == null) return;

            AccessibilityNodeInfo source = event.getSource();
            String windowClass = event.getClassName() == null
                ? null
                : event.getClassName().toString();
            String elementRole = null;

            if (source != null) {
                try {
                    if (source.isPassword()) return;
                    CharSequence className = source.getClassName();
                    if (className != null) elementRole = className.toString();
                } finally {
                    source.recycle();
                }
            }

            long now = System.currentTimeMillis();
            String key = appId + "|" + eventType + "|" + String.valueOf(windowClass) + "|" + String.valueOf(elementRole);
            if (key.equals(lastKey) && now - lastAt < MIN_EVENT_GAP_MS) return;
            lastKey = key;
            lastAt = now;

            JSONArray events = state.optJSONArray("observerEvents");
            if (events == null) events = new JSONArray();

            events.put(
                new JSONObject()
                    .put("observedAt", Instant.ofEpochMilli(now).toString())
                    .put("appId", appId)
                    .put("windowClass", windowClass == null ? JSONObject.NULL : windowClass)
                    .put("eventType", eventType)
                    .put("elementRole", elementRole == null ? JSONObject.NULL : elementRole)
            );

            JSONArray bounded = new JSONArray();
            int start = Math.max(0, events.length() - MAX_LOCAL_EVENTS);
            for (int i = start; i < events.length(); i++) bounded.put(events.get(i));

            state.put("observerEvents", bounded);
            secure.writeState(state);
        } catch (Exception ignored) {
            // Observer must never break normal tablet use.
        }
    }

    public static JSONObject flush(Context context, ApiClient api) throws Exception {
        SecureStore secure = new SecureStore(context);
        JSONObject state = secure.readState();
        if (!state.optBoolean("observerEnabled", false)) {
            return new JSONObject().put("accepted", 0).put("workflowDetected", false);
        }

        JSONArray events = state.optJSONArray("observerEvents");
        if (events == null || events.length() == 0) {
            return new JSONObject().put("accepted", 0).put("workflowDetected", false);
        }

        JSONArray batch = new JSONArray();
        int count = Math.min(events.length(), 50);
        for (int i = 0; i < count; i++) batch.put(events.get(i));

        JSONObject result = api.devicePostSync(
            "/api/device/observer/events",
            new JSONObject().put("events", batch)
        );

        JSONArray remaining = new JSONArray();
        for (int i = count; i < events.length(); i++) remaining.put(events.get(i));
        state.put("observerEvents", remaining);
        secure.writeState(state);

        return result;
    }

    public static void setEnabled(
        Context context,
        boolean enabled,
        Set<String> excludedApps,
        ApiClient api
    ) throws Exception {
        SecureStore secure = new SecureStore(context);
        JSONObject state = secure.readState();
        state.put("observerEnabled", enabled);
        state.put("observerExcludedApps", new JSONArray(excludedApps));
        if (!enabled) state.put("observerEvents", new JSONArray());
        secure.writeState(state);

        api.devicePostSync(
            "/api/device/observer",
            new JSONObject()
                .put("enabled", enabled)
                .put("excludedApps", new JSONArray(excludedApps))
                .put("anonymousImprovement", false)
        );
    }

    public static boolean isEnabled(Context context) {
        return new SecureStore(context).readState().optBoolean("observerEnabled", false);
    }

    public static Set<String> excludedApps(Context context) {
        return jsonSet(new SecureStore(context).readState().optJSONArray("observerExcludedApps"));
    }

    private static Set<String> jsonSet(JSONArray array) {
        Set<String> result = new HashSet<>();
        if (array == null) return result;
        for (int i = 0; i < array.length(); i++) {
            String value = array.optString(i, "");
            if (!value.isBlank()) result.add(value);
        }
        return result;
    }

    private static String eventType(int type) {
        return switch (type) {
            case AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED -> "window_changed";
            case AccessibilityEvent.TYPE_VIEW_CLICKED -> "clicked";
            case AccessibilityEvent.TYPE_VIEW_SCROLLED -> "scrolled";
            case AccessibilityEvent.TYPE_VIEW_FOCUSED -> "focused";
            default -> null;
        };
    }
}
