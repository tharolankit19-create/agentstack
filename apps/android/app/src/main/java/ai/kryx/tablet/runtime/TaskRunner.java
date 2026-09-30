package ai.kryx.tablet.runtime;

import android.content.Context;
import android.os.PowerManager;

import ai.kryx.tablet.approval.AppOpenApproval;
import ai.kryx.tablet.executor.KryxAccessibilityService;
import ai.kryx.tablet.executor.LaunchableApps;
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
        JSONObject state = secureStore.readState();
        JSONObject activeTask = state.optJSONObject("activeTask");
        if (activeTask != null) {
            JSONObject pendingApproval = state.optJSONObject("pendingAppApproval");
            boolean undecided =
                pendingApproval != null &&
                activeTask.optString("task_id").equals(pendingApproval.optString("taskId")) &&
                pendingApproval.optString("decision", "").isBlank();

            if (undecided) return false;

            runTask(activeTask);
            return true;
        }

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
            } else if ("sheets.write".equals(taskType)) {
                runSheetsWrite(task);
            } else if ("app.inspect".equals(taskType)) {
                runAppInspect(task);
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

    private void ensureAppOpenApproved(
        JSONObject task,
        String packageName,
        String appLabel
    ) throws Exception {
        String taskId = task.getString("task_id");
        if (AppOpenApproval.isApprovedNow(context, taskId, packageName)) return;

        AppOpenApproval.request(context, taskId, packageName, appLabel);
        throw new NeedsUserException(
            "app_open_approval_required",
            "Kryx is waiting for your approval before opening " + appLabel + "."
        );
    }

    private void runBrowserResearch(JSONObject task) throws Exception {
        KryxAccessibilityService executor = KryxAccessibilityService.get();
        if (executor == null) {
            throw new NeedsUserException(
                "accessibility_disabled",
                "Android Accessibility permission is required to continue this mission."
            );
        }

        ensureAppOpenApproved(task, "com.android.chrome", "Chrome");

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
        allowedApps.clearTemporary("com.android.chrome");
    }

    private void runAppInspect(JSONObject task) throws Exception {
        KryxAccessibilityService executor = KryxAccessibilityService.get();
        if (executor == null) {
            throw new NeedsUserException(
                "accessibility_disabled",
                "Android Accessibility permission is required to inspect this local app."
            );
        }

        Set<String> allowedActions = stringSet(task.optJSONArray("allowed_actions"));
        requireAction(allowedActions, "open_app");
        requireAction(allowedActions, "inspect_ui");

        String instruction = task.getString("instruction");
        String packageName = LaunchableApps.resolvePackage(context, instruction);
        if (packageName == null) {
            throw new NeedsUserException(
                "app_not_resolved",
                "Kryx could not identify which installed app this task refers to. Open Kryx and name the app explicitly."
            );
        }

        String appLabel = LaunchableApps.appLabel(context, packageName);
        ensureAppOpenApproved(task, packageName, appLabel);

        executor.openApp(packageName);
        sleep(1600);

        JSONObject snapshot = executor.inspectUI();
        maybeBlockForLogin(snapshot, appLabel);
        maybeBlockForVerification(snapshot);

        String[] navigationTerms = navigationTerms(instruction);
        if (navigationTerms.length > 0 && allowedActions.contains("tap")) {
            JSONObject target = findNode(
                snapshot.optJSONArray("nodes"),
                navigationTerms,
                true,
                false
            );

            if (target != null) {
                executor.tap(target.getString("id"));
                sleep(1000);
                snapshot = executor.inspectUI();
                maybeBlockForLogin(snapshot, appLabel);
                maybeBlockForVerification(snapshot);
            }
        }

        String visibleText = snapshot.optString("visibleText", "").trim();
        if (visibleText.isBlank()) {
            throw new NeedsUserException(
                "ui_not_readable",
                appLabel + " is open, but Android did not expose readable UI text on this screen."
            );
        }

        // Private content is sent only to the ephemeral summarization endpoint.
        // The raw text is not included in task evidence or task output.
        JSONObject summaryResponse = api.devicePostSync(
            "/api/device/private-summary",
            new JSONObject()
                .put("taskId", task.getString("task_id"))
                .put("nonce", task.getString("nonce"))
                .put("visibleText", visibleText)
                .put("request", instruction)
                .put("appLabel", appLabel)
        );

        String summary = summaryResponse.optString("summary", "").trim();
        if (summary.isBlank()) {
            throw new IllegalStateException("Kryx did not receive a usable private-context summary.");
        }

        JSONArray evidence = new JSONArray()
            .put(
                new JSONObject()
                    .put("kind", "action_receipt")
                    .put("title", appLabel + " inspected locally")
                    .put(
                        "content",
                        new JSONObject()
                            .put("action", "inspect_ui")
                            .put("app", packageName)
                            .put("method", "android_accessibility")
                            .put("rawContextPersisted", false)
                            .put("capturedAt", Instant.now().toString())
                    )
            )
            .put(
                new JSONObject()
                    .put("kind", "note")
                    .put("title", "Kryx summary")
                    .put(
                        "content",
                        new JSONObject()
                            .put("summary", summary)
                            .put("app", appLabel)
                            .put("privateContext", true)
                            .put("rawContextPersisted", false)
                    )
            );

        JSONObject output = new JSONObject()
            .put("summary", summary)
            .put("app", appLabel)
            .put("package", packageName)
            .put("rawContextPersisted", false)
            .put("creditsUsed", summaryResponse.optInt("creditsUsed", 0))
            .put("completedAt", Instant.now().toString());

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
        allowedApps.clearTemporary(packageName);
    }

    private static String[] navigationTerms(String instruction) {
        String text = instruction == null
            ? ""
            : instruction.toLowerCase(Locale.ROOT);

        if (
            text.contains("dm") ||
            text.contains("message") ||
            text.contains("inbox") ||
            text.contains("chat")
        ) {
            return new String[]{
                "messages",
                "message",
                "inbox",
                "direct messages",
                "direct message",
                "dm",
                "chat"
            };
        }

        if (
            text.contains("notification") ||
            text.contains("activity") ||
            text.contains("mentions")
        ) {
            return new String[]{"notifications", "activity", "mentions"};
        }

        if (
            text.contains("analytics") ||
            text.contains("insight") ||
            text.contains("performance")
        ) {
            return new String[]{"analytics", "insights", "performance"};
        }

        return new String[0];
    }

    private void runSheetsWrite(JSONObject task) throws Exception {
        KryxAccessibilityService executor = KryxAccessibilityService.get();
        if (executor == null) {
            throw new NeedsUserException(
                "accessibility_disabled",
                "Android Accessibility permission is required to write the approved Sheet."
            );
        }

        String sheetsPackage = "com.google.android.apps.docs.editors.sheets";
        ensureAppOpenApproved(task, sheetsPackage, "Google Sheets");

        Set<String> allowedActions = stringSet(task.optJSONArray("allowed_actions"));
        requireAction(allowedActions, "open_app");
        requireAction(allowedActions, "inspect_ui");
        requireAction(allowedActions, "tap");
        requireAction(allowedActions, "type");

        String rawTsv = dependencyText(task);
        String tsv = sanitizeTsv(rawTsv);
        int rowCount = Math.max(0, tsv.split("\\R", -1).length - 1);
        if (rowCount < 1) {
            throw new IllegalStateException("The qualification step did not produce spreadsheet rows.");
        }

        executor.openApp(sheetsPackage);
        sleep(1800);

        JSONObject first = executor.inspectUI();
        maybeBlockForLogin(first, "Google Sheets");

        JSONObject newSheet = findNode(
            first.optJSONArray("nodes"),
            new String[]{"new spreadsheet", "new sheet", "create new", "blank spreadsheet", "blank"},
            true,
            false
        );

        if (newSheet == null) {
            newSheet = findByViewIdHint(
                first.optJSONArray("nodes"),
                new String[]{"fab", "create", "new"},
                true
            );
        }

        if (newSheet != null) {
            executor.tap(newSheet.getString("id"));
            sleep(1200);

            JSONObject dialog = executor.inspectUI();
            maybeBlockForLogin(dialog, "Google Sheets");

            JSONObject titleField = firstEditable(dialog.optJSONArray("nodes"));
            if (titleField != null) {
                String hint = (
                    titleField.optString("text", "") + " " +
                    titleField.optString("description", "") + " " +
                    titleField.optString("viewId", "")
                ).toLowerCase(Locale.ROOT);

                if (
                    hint.contains("name") ||
                    hint.contains("title") ||
                    dialog.optString("visibleText", "").toLowerCase(Locale.ROOT).contains("new spreadsheet")
                ) {
                    executor.type(
                        titleField.getString("id"),
                        "Kryx Leads " + java.time.LocalDate.now(),
                        true
                    );

                    JSONObject namedDialog = executor.inspectUI();
                    JSONObject create = findNode(
                        namedDialog.optJSONArray("nodes"),
                        new String[]{"create", "ok", "done"},
                        true,
                        false
                    );
                    if (create != null) {
                        executor.tap(create.getString("id"));
                        sleep(1700);
                    }
                }
            }
        }

        JSONObject sheet = executor.inspectUI();
        maybeBlockForLogin(sheet, "Google Sheets");

        JSONObject editor = findSpreadsheetEditor(sheet.optJSONArray("nodes"));
        if (editor == null) {
            JSONObject a1 = findNode(
                sheet.optJSONArray("nodes"),
                new String[]{"a1", "cell a1", "column a row 1"},
                true,
                false
            );
            if (a1 != null) {
                executor.tap(a1.getString("id"));
                sleep(500);
                sheet = executor.inspectUI();
                editor = findSpreadsheetEditor(sheet.optJSONArray("nodes"));
            }
        }

        if (editor == null) {
            throw new NeedsUserException(
                "sheets_ui_changed",
                "Google Sheets opened, but Kryx could not find a safe editable cell. Open a blank sheet and retry."
            );
        }

        boolean pasted = executor.pasteText(editor.getString("id"), tsv);
        if (!pasted) {
            // Some Sheets versions expose an editable formula field that
            // supports ACTION_SET_TEXT but not ACTION_PASTE.
            pasted = executor.type(editor.getString("id"), tsv, true);
        }

        if (!pasted) {
            throw new NeedsUserException(
                "sheets_paste_blocked",
                "Google Sheets did not accept the approved table paste."
            );
        }

        sleep(800);
        JSONObject after = executor.inspectUI();

        JSONArray evidence = new JSONArray()
            .put(
                new JSONObject()
                    .put("kind", "action_receipt")
                    .put("title", "Qualified leads written to Google Sheets")
                    .put(
                        "content",
                        new JSONObject()
                            .put("action", "type")
                            .put("app", sheetsPackage)
                            .put("rowsWritten", rowCount)
                            .put("method", "accessibility_clipboard_paste")
                            .put("capturedAt", Instant.now().toString())
                    )
            )
            .put(
                new JSONObject()
                    .put("kind", "ui_receipt")
                    .put("title", "Google Sheets after write")
                    .put(
                        "content",
                        new JSONObject()
                            .put("package", after.optString("package", ""))
                            .put("windowTitle", after.opt("windowTitle"))
                    )
            );

        JSONObject output = new JSONObject()
            .put("rowsWritten", rowCount)
            .put("target", "Google Sheets")
            .put("method", "android_accessibility")
            .put("completedAt", Instant.now().toString());

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
        allowedApps.clearTemporary(sheetsPackage);
    }

    private static String dependencyText(JSONObject task) {
        JSONArray context = task.optJSONArray("dependency_context");
        if (context == null) return "";

        for (int i = context.length() - 1; i >= 0; i--) {
            JSONObject dependency = context.optJSONObject(i);
            JSONObject output = dependency == null ? null : dependency.optJSONObject("output");
            if (output == null) continue;
            String content = output.optString("content", "").trim();
            if (!content.isBlank()) return content;
        }
        return "";
    }

    private static String sanitizeTsv(String raw) {
        String value = raw == null ? "" : raw.trim();
        if (value.startsWith("```")) {
            value = value.replaceFirst("^\\x60\\x60\\x60[^\\n]*\\n?", "");
            value = value.replaceFirst("\\n?\\x60\\x60\\x60$", "");
        }

        StringBuilder out = new StringBuilder();
        String[] lines = value.split("\\R");
        int emitted = 0;

        for (String line : lines) {
            if (line.isBlank()) continue;
            String[] cells = line.split("\\t", -1);
            if (emitted > 0) out.append('\n');

            for (int index = 0; index < cells.length; index++) {
                if (index > 0) out.append('\t');
                String cell = cells[index]
                    .replace(String.valueOf((char) 0), "")
                    .replace('\r', ' ')
                    .replace('\n', ' ')
                    .trim();

                if (
                    !cell.isEmpty() &&
                    (cell.charAt(0) == '=' ||
                     cell.charAt(0) == '+' ||
                     cell.charAt(0) == '-' ||
                     cell.charAt(0) == '@')
                ) {
                    cell = "'" + cell;
                }

                out.append(cell);
            }

            emitted++;
            if (out.length() > 40_000) {
                throw new IllegalArgumentException("Spreadsheet payload is too large for one safe device action.");
            }
        }

        return out.toString();
    }

    private static JSONObject findSpreadsheetEditor(JSONArray nodes) {
        if (nodes == null) return null;

        for (int i = 0; i < nodes.length(); i++) {
            JSONObject node = nodes.optJSONObject(i);
            if (node == null || node.optBoolean("password", false)) continue;

            String haystack = (
                node.optString("text", "") + " " +
                node.optString("description", "") + " " +
                node.optString("viewId", "") + " " +
                node.optString("class", "")
            ).toLowerCase(Locale.ROOT);

            if (
                node.optBoolean("editable", false) &&
                (haystack.contains("cell") ||
                 haystack.contains("formula") ||
                 haystack.contains("edit") ||
                 haystack.contains("input"))
            ) {
                return node;
            }
        }

        return firstEditable(nodes);
    }

    private static JSONObject firstEditable(JSONArray nodes) {
        if (nodes == null) return null;
        for (int i = 0; i < nodes.length(); i++) {
            JSONObject node = nodes.optJSONObject(i);
            if (
                node != null &&
                node.optBoolean("editable", false) &&
                !node.optBoolean("password", false)
            ) {
                return node;
            }
        }
        return null;
    }

    private static JSONObject findByViewIdHint(
        JSONArray nodes,
        String[] hints,
        boolean clickable
    ) {
        if (nodes == null) return null;
        for (int i = 0; i < nodes.length(); i++) {
            JSONObject node = nodes.optJSONObject(i);
            if (node == null || node.optBoolean("password", false)) continue;
            if (clickable && !node.optBoolean("clickable", false)) continue;

            String id = node.optString("viewId", "").toLowerCase(Locale.ROOT);
            for (String hint : hints) {
                if (id.contains(hint.toLowerCase(Locale.ROOT))) return node;
            }
        }
        return null;
    }

    private static JSONObject findNode(
        JSONArray nodes,
        String[] terms,
        boolean clickable,
        boolean editable
    ) {
        if (nodes == null) return null;

        for (int i = 0; i < nodes.length(); i++) {
            JSONObject node = nodes.optJSONObject(i);
            if (node == null || node.optBoolean("password", false)) continue;
            if (clickable && !node.optBoolean("clickable", false)) continue;
            if (editable && !node.optBoolean("editable", false)) continue;

            String haystack = (
                node.optString("text", "") + " " +
                node.optString("description", "") + " " +
                node.optString("viewId", "")
            ).toLowerCase(Locale.ROOT);

            for (String term : terms) {
                if (haystack.contains(term.toLowerCase(Locale.ROOT))) return node;
            }
        }

        return null;
    }

    private static void maybeBlockForLogin(
        JSONObject snapshot,
        String appName
    ) throws NeedsUserException {
        String text = snapshot.optString("visibleText", "").toLowerCase(Locale.ROOT);
        if (
            text.contains("sign in") ||
            text.contains("choose an account") ||
            text.contains("verify it's you") ||
            text.contains("confirm it's you")
        ) {
            throw new NeedsUserException(
                "login_required",
                appName + " needs login or account verification."
            );
        }
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
