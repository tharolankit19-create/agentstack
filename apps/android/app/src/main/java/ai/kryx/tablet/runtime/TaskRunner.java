package ai.kryx.tablet.runtime;

import android.content.Context;
import android.os.PowerManager;

import ai.kryx.tablet.executor.KryxAccessibilityService;
import ai.kryx.tablet.net.ApiClient;
import ai.kryx.tablet.security.AllowedAppsStore;
import ai.kryx.tablet.security.SecureStore;

import org.json.JSONArray;
import org.json.JSONObject;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

public final class TaskRunner {
    private static final int MAX_SOURCE_TEXT = 6500;
    private static final int MAX_VISITED_SOURCES = 3;

    private final Context context;
    private final SecureStore secureStore;
    private final AllowedAppsStore allowedApps;
    private final ApiClient api;
    private final TaskEnvelopeVerifier verifier;

    public TaskRunner(Context context) {
        this.context = context.getApplicationContext();
        this.secureStore = new SecureStore(context);
        this.allowedApps = new AllowedAppsStore(context);
        this.api = new ApiClient(secureStore);
        this.verifier = new TaskEnvelopeVerifier(secureStore);
    }

    public boolean pollOnce() throws Exception {
        boolean advancedCloud = advanceOnePendingMission();

        JSONObject response = api.deviceGetSync("/api/device/tasks/next");
        JSONObject envelope = response.optJSONObject("task");
        if (envelope == null) return advancedCloud;

        JSONObject task = verifier.verify(envelope);
        runTask(task);
        return true;
    }

    private void runTask(JSONObject task) throws Exception {
        String taskId = task.getString("task_id");
        String nonce = task.getString("nonce");
        String taskType = task.getString("task_type");

        saveActiveTask(task);

        PowerManager manager = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        PowerManager.WakeLock wakeLock = manager.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "Kryx:Mission"
        );
        wakeLock.acquire(10 * 60_000L);

        try {
            postState(taskId, nonce, "running", null, new JSONArray(), null, null);

            if ("browser.research".equals(taskType)) {
                runBrowserResearch(task);
            } else {
                throw new IllegalStateException("Unsupported tablet task type: " + taskType);
            }

            clearActiveTask();
        } catch (NeedsUserException blocker) {
            postState(
                taskId,
                nonce,
                "waiting_for_user",
                null,
                blocker.evidence,
                blocker.code,
                blocker.getMessage()
            );
        } catch (Exception error) {
            JSONArray evidence = new JSONArray();
            evidence.put(
                new JSONObject()
                    .put("kind", "error")
                    .put("title", "Tablet execution failed")
                    .put(
                        "content",
                        new JSONObject()
                            .put("message", safeMessage(error))
                            .put("at", Instant.now().toString())
                    )
            );
            postState(
                taskId,
                nonce,
                "failed",
                null,
                evidence,
                "android_execution_failed",
                safeMessage(error)
            );
            clearActiveTask();
            throw error;
        } finally {
            if (wakeLock.isHeld()) wakeLock.release();
        }
    }

    private void runBrowserResearch(JSONObject task) throws Exception {
        KryxAccessibilityService executor = KryxAccessibilityService.get();
        if (executor == null) {
            throw new NeedsUserException(
                "accessibility_disabled",
                "Android Accessibility permission is required to continue this mission."
            );
        }

        if (!allowedApps.isAllowed("com.android.chrome")) {
            throw new NeedsUserException(
                "app_not_allowed",
                "Chrome is not in Kryx's allowed-app list."
            );
        }

        Set<String> allowedActions = stringSet(task.optJSONArray("allowed_actions"));
        requireAction(allowedActions, "open_url");
        requireAction(allowedActions, "inspect_ui");
        requireAction(allowedActions, "tap");
        requireAction(allowedActions, "back");

        String instruction = task.getString("instruction");
        String query = researchQuery(instruction);
        String searchUrl =
            "https://www.google.com/search?q=" +
            URLEncoder.encode(query, StandardCharsets.UTF_8);

        executor.openURL(searchUrl);
        sleep(2600);

        JSONArray evidence = new JSONArray();
        JSONObject searchSnapshot = executor.inspectUI();
        maybeBlockForVerification(searchSnapshot);

        evidence.put(sourceEvidence("Search results", searchSnapshot, searchUrl));

        Set<String> visitedLabels = new HashSet<>();
        Set<String> visitedUrls = new HashSet<>();

        for (int visit = 0; visit < MAX_VISITED_SOURCES; visit++) {
            JSONObject fresh = executor.inspectUI();
            maybeBlockForVerification(fresh);

            JSONObject candidate = chooseResultCandidate(
                fresh.optJSONArray("nodes"),
                visitedLabels
            );
            if (candidate == null) break;

            String label = candidate.optString("text", "").trim();
            visitedLabels.add(label.toLowerCase(Locale.ROOT));

            if (!executor.tap(candidate.getString("id"))) continue;
            sleep(2200);

            JSONObject page = executor.inspectUI();
            maybeBlockForVerification(page);

            String activeUrl = normalizeUrl(page.optString("activeUrl", ""));
            if (
                activeUrl != null &&
                !activeUrl.contains("google.com/search") &&
                visitedUrls.add(activeUrl)
            ) {
                evidence.put(sourceEvidence(label, page, activeUrl));
            }

            executor.back();
            sleep(1200);
        }

        if (evidence.length() <= 1) {
            // The search page itself is still real evidence; surface the
            // limitation rather than claiming multiple sources were visited.
            evidence.put(
                new JSONObject()
                    .put("kind", "note")
                    .put("title", "Browser limitation")
                    .put(
                        "content",
                        new JSONObject()
                            .put(
                                "message",
                                "Kryx read the live search results but Chrome did not expose stable result navigation nodes for multiple source visits."
                            )
                            .put("query", query)
                    )
            );
        }

        JSONObject output = new JSONObject()
            .put("query", query)
            .put("sourcesCaptured", countSourceEvidence(evidence))
            .put("collectedAt", Instant.now().toString())
            .put("deviceMethod", "android_accessibility");

        postState(
            task.getString("task_id"),
            task.getString("nonce"),
            "completed",
            output,
            evidence,
            null,
            null
        );
        rememberMissionForContinuation(task.getString("mission_id"));
    }

    private static JSONObject sourceEvidence(
        String label,
        JSONObject snapshot,
        String fallbackUrl
    ) throws Exception {
        String activeUrl = normalizeUrl(snapshot.optString("activeUrl", ""));
        String sourceUrl = activeUrl == null ? fallbackUrl : activeUrl;
        String text = snapshot.optString("visibleText", "");
        if (text.length() > MAX_SOURCE_TEXT) text = text.substring(0, MAX_SOURCE_TEXT);

        JSONObject evidence = new JSONObject()
            .put("kind", "source")
            .put("title", label == null || label.isBlank() ? "Browser source" : label)
            .put(
                "content",
                new JSONObject()
                    .put("visibleText", text)
                    .put("sourceTrust", "untrusted_external_content")
                    .put("package", snapshot.optString("package", ""))
                    .put("capturedAt", Instant.now().toString())
            );

        if (sourceUrl != null) evidence.put("sourceUrl", sourceUrl);
        return evidence;
    }

    private static JSONObject chooseResultCandidate(
        JSONArray nodes,
        Set<String> visitedLabels
    ) {
        if (nodes == null) return null;

        for (int i = 0; i < nodes.length(); i++) {
            JSONObject node = nodes.optJSONObject(i);
            if (node == null || !node.optBoolean("clickable", false)) continue;
            if (node.optBoolean("password", false)) continue;

            String text = node.optString("text", "").trim();
            if (text.length() < 8 || text.length() > 180) continue;

            String lower = text.toLowerCase(Locale.ROOT);
            if (visitedLabels.contains(lower)) continue;
            if (
                lower.equals("search") ||
                lower.equals("images") ||
                lower.equals("videos") ||
                lower.equals("news") ||
                lower.equals("maps") ||
                lower.equals("shopping") ||
                lower.contains("sign in") ||
                lower.contains("google apps") ||
                lower.contains("more results") ||
                lower.contains("accessibility")
            ) {
                continue;
            }

            return node;
        }

        return null;
    }

    private static String researchQuery(String instruction) {
        String cleaned = instruction
            .replaceAll("(?i)\\b(open|browser|research|find|prepare|create|summary|summarize)\\b", " ")
            .replaceAll("\\s+", " ")
            .trim();

        if (cleaned.isBlank()) return instruction;
        return cleaned.length() > 180 ? cleaned.substring(0, 180) : cleaned;
    }

    private static void maybeBlockForVerification(JSONObject snapshot) throws NeedsUserException {
        String text = snapshot.optString("visibleText", "").toLowerCase(Locale.ROOT);
        if (
            text.contains("captcha") ||
            text.contains("verify you are human") ||
            text.contains("unusual traffic") ||
            text.contains("enter verification code") ||
            text.contains("two-step verification") ||
            text.contains("2-step verification") ||
            text.contains("confirm it's you")
        ) {
            JSONArray evidence = new JSONArray();
            try {
                evidence.put(
                    new JSONObject()
                        .put("kind", "ui_receipt")
                        .put("title", "Verification required")
                        .put(
                            "content",
                            new JSONObject()
                                .put("message", "The active app requires human verification.")
                                .put("sourceTrust", "untrusted_external_content")
                        )
                );
            } catch (Exception ignored) {}
            throw new NeedsUserException(
                "verification_required",
                "The active browser session requires CAPTCHA, 2FA or account verification.",
                evidence
            );
        }
    }

    private boolean advanceOnePendingMission() throws Exception {
        JSONObject state = secureStore.readState();
        JSONArray pending = state.optJSONArray("missionsToAdvance");
        if (pending == null || pending.length() == 0) return false;

        String missionId = pending.optString(0, "");
        if (missionId.isBlank()) {
            removePendingMission(missionId);
            return false;
        }

        JSONObject missionState = api.deviceGetSync("/api/device/missions/" + missionId);
        JSONObject mission = missionState.optJSONObject("mission");
        String status = mission == null ? "" : mission.optString("status", "");

        if (
            "completed".equals(status) ||
            "failed".equals(status) ||
            "cancelled".equals(status)
        ) {
            removePendingMission(missionId);
            return false;
        }

        api.devicePostSync(
            "/api/device/missions/" + missionId + "/advance",
            new JSONObject()
        );
        return true;
    }

    private void rememberMissionForContinuation(String missionId) {
        try {
            JSONObject state = secureStore.readState();
            JSONArray pending = state.optJSONArray("missionsToAdvance");
            if (pending == null) pending = new JSONArray();

            for (int i = 0; i < pending.length(); i++) {
                if (missionId.equals(pending.optString(i))) return;
            }

            pending.put(missionId);
            state.put("missionsToAdvance", pending);
            secureStore.writeState(state);
        } catch (Exception ignored) {}
    }

    private void removePendingMission(String missionId) {
        try {
            JSONObject state = secureStore.readState();
            JSONArray pending = state.optJSONArray("missionsToAdvance");
            JSONArray next = new JSONArray();

            if (pending != null) {
                for (int i = 0; i < pending.length(); i++) {
                    String value = pending.optString(i, "");
                    if (!value.equals(missionId) && !value.isBlank()) next.put(value);
                }
            }

            state.put("missionsToAdvance", next);
            secureStore.writeState(state);
        } catch (Exception ignored) {}
    }

    private void postState(
        String taskId,
        String nonce,
        String status,
        JSONObject output,
        JSONArray evidence,
        String errorCode,
        String errorMessage
    ) throws Exception {
        JSONObject body = new JSONObject()
            .put("nonce", nonce)
            .put("status", status)
            .put("evidence", evidence == null ? new JSONArray() : evidence);

        if (output != null) body.put("output", output);
        if (errorCode != null) body.put("errorCode", errorCode);
        if (errorMessage != null) body.put("errorMessage", errorMessage);

        api.devicePostSync("/api/device/tasks/" + taskId + "/status", body);
    }

    private void saveActiveTask(JSONObject task) throws Exception {
        JSONObject state = secureStore.readState();
        state.put("activeTask", task);
        secureStore.writeState(state);
    }

    private void clearActiveTask() {
        try {
            JSONObject state = secureStore.readState();
            state.remove("activeTask");
            secureStore.writeState(state);
        } catch (Exception ignored) {}
    }

    private static Set<String> stringSet(JSONArray array) {
        Set<String> result = new HashSet<>();
        if (array == null) return result;
        for (int i = 0; i < array.length(); i++) {
            String value = array.optString(i, "");
            if (!value.isBlank()) result.add(value);
        }
        return result;
    }

    private static void requireAction(Set<String> allowed, String action) {
        if (!allowed.contains(action)) {
            throw new SecurityException(
                "Signed task policy does not allow Android action: " + action
            );
        }
    }

    private static int countSourceEvidence(JSONArray evidence) {
        int count = 0;
        for (int i = 0; i < evidence.length(); i++) {
            JSONObject item = evidence.optJSONObject(i);
            if (item != null && "source".equals(item.optString("kind"))) count++;
        }
        return count;
    }

    private static String normalizeUrl(String raw) {
        if (raw == null) return null;
        String value = raw.trim();
        if (value.isBlank()) return null;
        if (value.startsWith("https://") || value.startsWith("http://")) return value;
        if (value.contains(".") && !value.contains(" ")) return "https://" + value;
        return null;
    }

    private static String safeMessage(Exception error) {
        String message = error.getMessage();
        return message == null || message.isBlank()
            ? error.getClass().getSimpleName()
            : message;
    }

    private static void sleep(long milliseconds) throws InterruptedException {
        Thread.sleep(milliseconds);
    }

    private static final class NeedsUserException extends Exception {
        final String code;
        final JSONArray evidence;

        NeedsUserException(String code, String message) {
            this(code, message, new JSONArray());
        }

        NeedsUserException(String code, String message, JSONArray evidence) {
            super(message);
            this.code = code;
            this.evidence = evidence;
        }
    }
}
