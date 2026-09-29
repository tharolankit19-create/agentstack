package ai.kryx.tablet.executor;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.GestureDescription;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Path;
import android.graphics.Rect;
import android.net.Uri;
import android.os.Bundle;
import android.provider.Settings;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;

import ai.kryx.tablet.MainActivity;
import ai.kryx.tablet.observer.ObserverRecorder;
import ai.kryx.tablet.security.AllowedAppsStore;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

public final class KryxAccessibilityService extends AccessibilityService implements DeviceExecutor {
    private static final int MAX_NODES = 350;
    private static final int MAX_TEXT_CHARS = 24_000;
    private static final String CHANNEL_ID = "kryx_agent_status";

    private static volatile KryxAccessibilityService instance;
    private AllowedAppsStore allowedApps;

    public static KryxAccessibilityService get() {
        return instance;
    }

    public static boolean isEnabled(Context context) {
        String enabled = Settings.Secure.getString(
            context.getContentResolver(),
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
        );
        return enabled != null && enabled.contains(context.getPackageName() + "/.executor.KryxAccessibilityService");
    }

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        instance = this;
        allowedApps = new AllowedAppsStore(this);
        ensureNotificationChannel();
    }

    @Override
    public void onDestroy() {
        if (instance == this) instance = null;
        super.onDestroy();
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event == null || allowedApps == null) return;
        CharSequence packageName = event.getPackageName();
        if (packageName == null || !allowedApps.isAllowed(packageName.toString())) return;

        // Observer Mode persists only structured, non-sensitive metadata into
        // the encrypted local buffer. It never copies typed or visible text.
        ObserverRecorder.record(this, event);
    }

    @Override
    public void onInterrupt() {
        // A later task runner records this as blocked/interrupted. No silent retry loop.
    }

    @Override
    public JSONObject capabilities() {
        try {
            return new JSONObject()
                .put("accessibility_control", true)
                .put("inspect_ui", true)
                .put("tap", true)
                .put("type", true)
                .put("scroll", true)
                .put("swipe", true)
                .put("global_navigation", true)
                .put("open_app", true)
                .put("open_url", true)
                .put("screen_understanding", false)
                .put("notifications", true);
        } catch (Exception error) {
            return new JSONObject();
        }
    }

    private AccessibilityNodeInfo allowedRoot() {
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) return null;
        CharSequence packageName = root.getPackageName();
        if (packageName == null || !allowedApps.isAllowed(packageName.toString())) {
            root.recycle();
            return null;
        }
        return root;
    }

    private void requireAllowedPackage(String packageName) {
        if (packageName == null || !allowedApps.isAllowed(packageName)) {
            throw new SecurityException("Kryx is not allowed to operate this app.");
        }
    }

    @Override
    public boolean openApp(String packageName) throws Exception {
        requireAllowedPackage(packageName);
        Intent launch = getPackageManager().getLaunchIntentForPackage(packageName);
        if (launch == null) throw new IllegalStateException("App is not installed: " + packageName);
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivity(launch);
        return true;
    }

    @Override
    public boolean openURL(String rawUrl) throws Exception {
        Uri uri = Uri.parse(rawUrl);
        String scheme = uri.getScheme();
        if (!"https".equalsIgnoreCase(scheme) && !"http".equalsIgnoreCase(scheme)) {
            throw new SecurityException("Kryx only opens http/https URLs.");
        }
        if (!allowedApps.isAllowed("com.android.chrome")) {
            throw new SecurityException("Chrome is not in the allowed-app list.");
        }

        Intent intent = new Intent(Intent.ACTION_VIEW, uri);
        intent.setPackage("com.android.chrome");
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivity(intent);
        return true;
    }

    @Override
    public JSONObject inspectUI() throws Exception {
        AccessibilityNodeInfo root = allowedRoot();
        if (root == null) {
            throw new SecurityException("The active app is not allowed or exposes no accessibility tree.");
        }

        try {
            JSONObject result = new JSONObject();
            result.put("sourceTrust", "untrusted_external_content");
            result.put("package", String.valueOf(root.getPackageName()));
            result.put("windowTitle", root.getWindow() != null && root.getWindow().getTitle() != null
                ? root.getWindow().getTitle().toString()
                : JSONObject.NULL);

            JSONArray nodes = new JSONArray();
            StringBuilder visibleText = new StringBuilder();
            int[] count = new int[]{0};
            walk(root, "0", nodes, visibleText, count);
            result.put("nodes", nodes);

            if ("com.android.chrome".contentEquals(root.getPackageName())) {
                try {
                    java.util.List<AccessibilityNodeInfo> urlNodes =
                        root.findAccessibilityNodeInfosByViewId("com.android.chrome:id/url_bar");
                    if (urlNodes != null && !urlNodes.isEmpty()) {
                        AccessibilityNodeInfo urlNode = urlNodes.get(0);
                        if (urlNode != null && !urlNode.isPassword() && urlNode.getText() != null) {
                            result.put("activeUrl", urlNode.getText().toString());
                        }
                        for (AccessibilityNodeInfo item : urlNodes) {
                            if (item != null) item.recycle();
                        }
                    }
                } catch (Exception ignored) {
                    // Chrome UI ids may change. Missing activeUrl is recoverable.
                }
            }
            result.put(
                "visibleText",
                visibleText.length() > MAX_TEXT_CHARS
                    ? visibleText.substring(0, MAX_TEXT_CHARS)
                    : visibleText.toString()
            );
            return result;
        } finally {
            root.recycle();
        }
    }

    private void walk(
        AccessibilityNodeInfo node,
        String path,
        JSONArray nodes,
        StringBuilder visibleText,
        int[] count
    ) throws Exception {
        if (node == null || count[0] >= MAX_NODES) return;
        count[0] += 1;

        if (node.isVisibleToUser()) {
            JSONObject item = new JSONObject();
            item.put("id", path);
            item.put("class", safe(node.getClassName()));
            item.put("viewId", safe(node.getViewIdResourceName()));
            item.put("clickable", node.isClickable());
            item.put("editable", node.isEditable());
            item.put("scrollable", node.isScrollable());
            item.put("enabled", node.isEnabled());
            item.put("password", node.isPassword());

            Rect bounds = new Rect();
            node.getBoundsInScreen(bounds);
            item.put(
                "bounds",
                new JSONObject()
                    .put("left", bounds.left)
                    .put("top", bounds.top)
                    .put("right", bounds.right)
                    .put("bottom", bounds.bottom)
            );

            if (!node.isPassword()) {
                String text = safe(node.getText());
                String description = safe(node.getContentDescription());
                item.put("text", text);
                item.put("description", description);

                if (!text.isBlank()) {
                    if (visibleText.length() > 0) visibleText.append('\n');
                    visibleText.append(text);
                } else if (!description.isBlank()) {
                    if (visibleText.length() > 0) visibleText.append('\n');
                    visibleText.append(description);
                }
            } else {
                item.put("text", JSONObject.NULL);
                item.put("description", JSONObject.NULL);
            }

            nodes.put(item);
        }

        int children = Math.min(node.getChildCount(), 80);
        for (int index = 0; index < children && count[0] < MAX_NODES; index++) {
            AccessibilityNodeInfo child = node.getChild(index);
            if (child == null) continue;
            try {
                walk(child, path + "/" + index, nodes, visibleText, count);
            } finally {
                child.recycle();
            }
        }
    }

    private AccessibilityNodeInfo resolve(String nodePath) {
        AccessibilityNodeInfo root = allowedRoot();
        if (root == null) return null;
        if ("0".equals(nodePath)) return root;

        String[] pieces = nodePath.split("/");
        if (pieces.length == 0 || !"0".equals(pieces[0])) {
            root.recycle();
            return null;
        }

        AccessibilityNodeInfo current = root;
        for (int i = 1; i < pieces.length; i++) {
            int childIndex;
            try {
                childIndex = Integer.parseInt(pieces[i]);
            } catch (NumberFormatException error) {
                current.recycle();
                return null;
            }
            AccessibilityNodeInfo child = current.getChild(childIndex);
            current.recycle();
            if (child == null) return null;
            current = child;
        }
        return current;
    }

    @Override
    public boolean tap(String nodePath) throws Exception {
        AccessibilityNodeInfo node = resolve(nodePath);
        if (node == null) throw new IllegalStateException("UI changed. Reinspect before tapping.");
        try {
            if (node.isPassword()) throw new SecurityException("Kryx will not interact with password fields.");
            AccessibilityNodeInfo target = node;
            while (target != null && !target.isClickable()) {
                AccessibilityNodeInfo parent = target.getParent();
                if (target != node) target.recycle();
                target = parent;
            }
            if (target == null) return false;
            try {
                return target.performAction(AccessibilityNodeInfo.ACTION_CLICK);
            } finally {
                if (target != node) target.recycle();
            }
        } finally {
            node.recycle();
        }
    }

    @Override
    public boolean type(String nodePath, String text, boolean replace) throws Exception {
        if (text == null) text = "";
        AccessibilityNodeInfo node = resolve(nodePath);
        if (node == null) throw new IllegalStateException("UI changed. Reinspect before typing.");

        try {
            if (node.isPassword()) throw new SecurityException("Kryx will not type into password fields.");
            if (!node.isEditable()) throw new IllegalStateException("Selected UI element is not editable.");

            CharSequence existing = node.getText();
            String value = replace ? text : (existing == null ? "" : existing.toString()) + text;
            Bundle args = new Bundle();
            args.putCharSequence(
                AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE,
                value
            );

            if (node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)) {
                return true;
            }

            // Clipboard fallback is local-only and immediately overwritten with
            // an empty clip after paste. It is never used for password fields.
            ClipboardManager clipboard = (ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
            clipboard.setPrimaryClip(ClipData.newPlainText("Kryx", value));
            node.performAction(AccessibilityNodeInfo.ACTION_FOCUS);
            boolean pasted = node.performAction(AccessibilityNodeInfo.ACTION_PASTE);
            clipboard.setPrimaryClip(ClipData.newPlainText("", ""));
            return pasted;
        } finally {
            node.recycle();
        }
    }

    @Override
    public boolean scroll(String nodePath, boolean forward) throws Exception {
        AccessibilityNodeInfo node = resolve(nodePath);
        if (node == null) throw new IllegalStateException("UI changed. Reinspect before scrolling.");
        try {
            int action = forward
                ? AccessibilityNodeInfo.ACTION_SCROLL_FORWARD
                : AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD;
            return node.performAction(action);
        } finally {
            node.recycle();
        }
    }

    @Override
    public boolean swipe(
        float startX,
        float startY,
        float endX,
        float endY,
        long durationMs
    ) throws Exception {
        Path path = new Path();
        path.moveTo(startX, startY);
        path.lineTo(endX, endY);

        CountDownLatch latch = new CountDownLatch(1);
        boolean[] completed = new boolean[]{false};
        GestureDescription gesture = new GestureDescription.Builder()
            .addStroke(new GestureDescription.StrokeDescription(
                path,
                0,
                Math.max(100L, Math.min(durationMs, 2_000L))
            ))
            .build();

        boolean dispatched = dispatchGesture(
            gesture,
            new GestureResultCallback() {
                @Override
                public void onCompleted(GestureDescription gestureDescription) {
                    completed[0] = true;
                    latch.countDown();
                }

                @Override
                public void onCancelled(GestureDescription gestureDescription) {
                    latch.countDown();
                }
            },
            null
        );
        if (!dispatched) return false;
        latch.await(3, TimeUnit.SECONDS);
        return completed[0];
    }

    public boolean back() {
        return performGlobalAction(GLOBAL_ACTION_BACK);
    }

    public boolean home() {
        return performGlobalAction(GLOBAL_ACTION_HOME);
    }

    public boolean recents() {
        return performGlobalAction(GLOBAL_ACTION_RECENTS);
    }

    @Override
    public String readScreen() throws Exception {
        return inspectUI().optString("visibleText", "");
    }

    @Override
    public void notifyUser(String title, String body) {
        ensureNotificationChannel();
        Intent open = new Intent(this, MainActivity.class);
        PendingIntent pending = PendingIntent.getActivity(
            this,
            0,
            open,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        android.app.Notification notification = new android.app.Notification.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.stat_notify_more)
            .setContentTitle(title)
            .setContentText(body)
            .setContentIntent(pending)
            .setAutoCancel(true)
            .build();

        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        manager.notify((int) (System.currentTimeMillis() & 0x7fffffff), notification);
    }

    private void ensureNotificationChannel() {
        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "Kryx agent status",
            NotificationManager.IMPORTANCE_DEFAULT
        );
        channel.setDescription("Mission results, approvals and blockers.");
        manager.createNotificationChannel(channel);
    }

    public Set<String> allowedPackages() {
        return allowedApps == null ? Set.of() : allowedApps.get();
    }

    private static String safe(CharSequence value) {
        return value == null ? "" : value.toString();
    }

    private static String safe(String value) {
        return value == null ? "" : value;
    }
}
