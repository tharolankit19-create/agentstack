package ai.kryx.tablet;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.res.Configuration;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.util.Base64;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import ai.kryx.tablet.executor.KryxAccessibilityService;
import ai.kryx.tablet.executor.LaunchableApps;
import ai.kryx.tablet.net.ApiClient;
import ai.kryx.tablet.observer.ObserverRecorder;
import ai.kryx.tablet.overlay.KryxOverlayService;
import ai.kryx.tablet.runtime.KryxMissionService;
import ai.kryx.tablet.security.AllowedAppsStore;
import ai.kryx.tablet.security.DeviceKeyStore;
import ai.kryx.tablet.security.SecureStore;

import org.json.JSONArray;
import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

public final class MainActivity extends Activity {
    private static final long HEARTBEAT_MS = 30_000L;

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final Map<String, String> commonApps = new LinkedHashMap<>();

    private SecureStore secureStore;
    private AllowedAppsStore allowedApps;
    private DeviceKeyStore deviceKeyStore;
    private ApiClient api;

    private TextView statusText;
    private TextView titleText;
    private TextView detailText;
    private TextView creditsText;
    private TextView agentsText;
    private TextView runtimeText;
    private LinearLayout allowedAppsContainer;
    private LinearLayout observerExcludedContainer;
    private CheckBox observerToggle;
    private EditText missionInput;
    private Button missionButton;
    private Button loginButton;
    private Button accessibilityButton;
    private Button overlayButton;
    private Button disconnectButton;

    private JSONObject account = null;
    private JSONArray agents = new JSONArray();

    private final Runnable heartbeatRunnable = new Runnable() {
        @Override
        public void run() {
            sendHeartbeat();
            mainHandler.postDelayed(this, HEARTBEAT_MS);
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        secureStore = new SecureStore(this);
        allowedApps = new AllowedAppsStore(this);
        deviceKeyStore = new DeviceKeyStore();
        api = new ApiClient(secureStore);

        commonApps.put("Chrome", "com.android.chrome");
        commonApps.put("Gmail", "com.google.android.gm");
        commonApps.put("Google Sheets", "com.google.android.apps.docs.editors.sheets");
        commonApps.put("X", "com.twitter.android");
        commonApps.put("LinkedIn", "com.linkedin.android");
        commonApps.put("Notion", "notion.id");
        commonApps.put("Slack", "com.Slack");
        commonApps.put("Telegram", "org.telegram.messenger");
        for (Map.Entry<String, String> entry : LaunchableApps.list(this).entrySet()) {
            if (!commonApps.containsValue(entry.getValue())) {
                commonApps.put(entry.getKey(), entry.getValue());
            }
        }

        buildUi();
        requestNotificationPermissionIfNeeded();
        handleDeepLink(getIntent());

        if (isSignedIn()) {
            loadAccount();
            startHeartbeat();
            startMissionRuntime();
        } else {
            render();
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleDeepLink(intent);
    }

    @Override
    protected void onResume() {
        super.onResume();
        completePendingOverlayPermission();
        renderPermissionState();
        renderAllowedApps();
        renderObserverControls();
        if (isSignedIn()) {
            startOverlayIfEnabled();
            sendHeartbeat();
        }
    }

    @Override
    protected void onDestroy() {
        mainHandler.removeCallbacks(heartbeatRunnable);
        super.onDestroy();
    }

    private void buildUi() {
        boolean wide = getResources().getConfiguration().screenWidthDp >= 720;

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(wide ? LinearLayout.HORIZONTAL : LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.rgb(246, 246, 243));
        root.setPadding(dp(18), dp(18), dp(18), dp(18));

        LinearLayout sidebar = createSidebar(wide);
        root.addView(
            sidebar,
            wide
                ? new LinearLayout.LayoutParams(dp(250), ViewGroup.LayoutParams.MATCH_PARENT)
                : new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
        );

        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setPadding(wide ? dp(34) : 0, wide ? dp(22) : dp(28), 0, dp(48));
        scroll.addView(content);

        root.addView(
            scroll,
            wide
                ? new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.MATCH_PARENT, 1f)
                : new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f)
        );

        TextView eyebrow = text("KRYX TABLET", 11, Color.rgb(112, 116, 123), true);
        content.addView(eyebrow);

        titleText = text("Your marketing agents, now on this tablet.", 32, Color.rgb(22, 23, 25), true);
        titleText.setPadding(0, dp(10), 0, 0);
        content.addView(titleText);

        detailText = text(
            "Same Kryx account, same agents and credits. Device control stays local and only allowed apps can be operated.",
            15,
            Color.rgb(91, 95, 102),
            false
        );
        detailText.setPadding(0, dp(14), 0, dp(22));
        content.addView(detailText);

        LinearLayout authRow = new LinearLayout(this);
        authRow.setOrientation(LinearLayout.HORIZONTAL);
        authRow.setGravity(Gravity.START | Gravity.CENTER_VERTICAL);

        loginButton = button("Continue with Google");
        loginButton.setOnClickListener(v -> beginLogin());
        authRow.addView(loginButton);

        disconnectButton = button("Disconnect tablet");
        disconnectButton.setOnClickListener(v -> disconnect());
        LinearLayout.LayoutParams disconnectParams = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        );
        disconnectParams.setMargins(dp(10), 0, 0, 0);
        authRow.addView(disconnectButton, disconnectParams);

        content.addView(authRow);

        LinearLayout metrics = new LinearLayout(this);
        metrics.setOrientation(wide ? LinearLayout.HORIZONTAL : LinearLayout.VERTICAL);
        metrics.setPadding(0, dp(24), 0, 0);

        creditsText = metric("Credits", "—", "AI and paid tool work only");
        agentsText = metric("Agents", "—", "shared cloud roster");
        runtimeText = metric("Tablet runtime", "Offline", "Accessibility + device channel");

        addMetric(metrics, creditsText, wide);
        addMetric(metrics, agentsText, wide);
        addMetric(metrics, runtimeText, wide);
        content.addView(metrics);

        TextView permissionHeading = sectionHeading("Computer access");
        content.addView(permissionHeading);

        TextView permissionCopy = text(
            "Accessibility lets Kryx inspect and control app interfaces only when you ask it to. It does not grant access to every app automatically.",
            14,
            Color.rgb(88, 91, 97),
            false
        );
        content.addView(permissionCopy);

        accessibilityButton = button("Enable Accessibility");
        accessibilityButton.setOnClickListener(v -> {
            Intent intent = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
            startActivity(intent);
        });
        LinearLayout.LayoutParams permissionButtonParams = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        );
        permissionButtonParams.setMargins(0, dp(12), 0, 0);
        content.addView(accessibilityButton, permissionButtonParams);

        TextView floatingHeading = sectionHeading("Floating control");
        content.addView(floatingHeading);

        TextView floatingCopy = text(
            "Optional. Show a small Kryx button over other apps so you can give this tablet a task without switching back to Kryx.",
            14,
            Color.rgb(88, 91, 97),
            false
        );
        content.addView(floatingCopy);

        overlayButton = button("Enable floating control");
        overlayButton.setOnClickListener(v -> toggleFloatingControl());
        LinearLayout.LayoutParams overlayButtonParams = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        );
        overlayButtonParams.setMargins(0, dp(12), 0, 0);
        content.addView(overlayButton, overlayButtonParams);

        TextView appsHeading = sectionHeading("Allowed apps");
        content.addView(appsHeading);

        TextView appsCopy = text(
            "Choose the apps Kryx may operate. This is separate from Android's Accessibility permission.",
            14,
            Color.rgb(88, 91, 97),
            false
        );
        content.addView(appsCopy);

        allowedAppsContainer = new LinearLayout(this);
        allowedAppsContainer.setOrientation(LinearLayout.VERTICAL);
        allowedAppsContainer.setPadding(0, dp(10), 0, 0);
        content.addView(allowedAppsContainer);

        TextView observerHeading = sectionHeading("Observer Mode");
        content.addView(observerHeading);

        TextView observerCopy = text(
            "Optional. Kryx can learn repeated marketing workflows from sanitized app/window/action metadata. It never records passwords, typed message bodies or screenshots here.",
            14,
            Color.rgb(88, 91, 97),
            false
        );
        content.addView(observerCopy);

        observerToggle = new CheckBox(this);
        observerToggle.setText("Enable Observer Mode");
        observerToggle.setTextSize(14);
        observerToggle.setTextColor(Color.rgb(39, 41, 45));
        observerToggle.setPadding(0, dp(8), 0, 0);
        observerToggle.setOnCheckedChangeListener((button, checked) -> {
            if (!button.isPressed()) return;
            updateObserverSettings(checked, ObserverRecorder.excludedApps(this));
        });
        content.addView(observerToggle);

        TextView excludedLabel = text(
            "Never observe these apps",
            12,
            Color.rgb(112, 116, 123),
            true
        );
        excludedLabel.setPadding(0, dp(10), 0, dp(4));
        content.addView(excludedLabel);

        observerExcludedContainer = new LinearLayout(this);
        observerExcludedContainer.setOrientation(LinearLayout.VERTICAL);
        content.addView(observerExcludedContainer);

        TextView missionHeading = sectionHeading("Mission");
        content.addView(missionHeading);

        missionInput = new EditText(this);
        missionInput.setHint("What do you want Kryx to do?");
        missionInput.setTextColor(Color.rgb(18, 19, 21));
        missionInput.setHintTextColor(Color.rgb(133, 137, 143));
        missionInput.setTextSize(16);
        missionInput.setMinHeight(dp(72));
        missionInput.setPadding(dp(14), dp(12), dp(14), dp(12));
        missionInput.setBackgroundColor(Color.WHITE);
        content.addView(
            missionInput,
            new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
        );

        missionButton = button("Start Mission");
        missionButton.setOnClickListener(v -> startMission());
        LinearLayout.LayoutParams missionButtonParams = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        );
        missionButtonParams.setMargins(0, dp(10), 0, 0);
        content.addView(missionButton, missionButtonParams);

        statusText = text("", 13, Color.rgb(95, 99, 106), false);
        statusText.setPadding(0, dp(16), 0, 0);
        content.addView(statusText);

        setContentView(root);
        renderAllowedApps();
        renderObserverControls();
        render();
    }

    private LinearLayout createSidebar(boolean wide) {
        LinearLayout sidebar = new LinearLayout(this);
        sidebar.setOrientation(LinearLayout.VERTICAL);
        sidebar.setPadding(dp(14), dp(18), dp(14), dp(18));
        sidebar.setBackgroundColor(Color.rgb(236, 236, 232));

        TextView logo = text("KRYX", 18, Color.rgb(16, 17, 19), true);
        sidebar.addView(logo);

        TextView label = text("MARKETING AGENT ARMY", 10, Color.rgb(112, 116, 123), true);
        label.setPadding(0, dp(6), 0, dp(24));
        sidebar.addView(label);

        String[] nav = {"Missions", "Agents", "Needs You", "Finished", "Devices", "Privacy"};
        for (String item : nav) {
            TextView row = text(item, 14, Color.rgb(64, 67, 72), "Missions".equals(item));
            row.setPadding(dp(10), dp(10), dp(10), dp(10));
            sidebar.addView(row);
        }

        TextView device = text(
            Build.MANUFACTURER + " " + Build.MODEL,
            12,
            Color.rgb(106, 110, 117),
            false
        );
        LinearLayout.LayoutParams deviceParams = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        );
        deviceParams.weight = wide ? 1f : 0f;
        deviceParams.gravity = Gravity.BOTTOM;
        device.setGravity(Gravity.BOTTOM);
        device.setPadding(dp(10), dp(20), dp(10), 0);
        sidebar.addView(device, deviceParams);
        return sidebar;
    }

    private TextView metric(String label, String value, String hint) {
        TextView card = text(
            label.toUpperCase() + "\n\n" + value + "\n" + hint,
            13,
            Color.rgb(42, 44, 48),
            false
        );
        card.setPadding(dp(16), dp(16), dp(16), dp(16));
        card.setBackgroundColor(Color.WHITE);
        card.setTag(new String[]{label, value, hint});
        return card;
    }

    private void addMetric(LinearLayout metrics, TextView view, boolean wide) {
        LinearLayout.LayoutParams params = wide
            ? new LinearLayout.LayoutParams(0, dp(132), 1f)
            : new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(120));
        params.setMargins(0, 0, wide ? dp(10) : 0, dp(10));
        metrics.addView(view, params);
    }

    private TextView sectionHeading(String value) {
        TextView heading = text(value, 20, Color.rgb(18, 19, 21), true);
        heading.setPadding(0, dp(30), 0, dp(8));
        return heading;
    }

    private TextView text(String value, int size, int color, boolean bold) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(size);
        view.setTextColor(color);
        view.setLineSpacing(0f, 1.08f);
        if (bold) view.setTypeface(view.getTypeface(), android.graphics.Typeface.BOLD);
        return view;
    }

    private Button button(String label) {
        Button button = new Button(this);
        button.setText(label);
        button.setAllCaps(false);
        button.setTextSize(14);
        button.setPadding(dp(14), dp(7), dp(14), dp(7));
        return button;
    }

    private void render() {
        boolean signedIn = isSignedIn();
        loginButton.setVisibility(signedIn ? View.GONE : View.VISIBLE);
        disconnectButton.setVisibility(signedIn ? View.VISIBLE : View.GONE);
        missionInput.setEnabled(signedIn);
        missionButton.setEnabled(signedIn);

        if (!signedIn) {
            titleText.setText("Your marketing agents, now on this tablet.");
            detailText.setText(
                "Continue with Google to connect this tablet to your existing Kryx account."
            );
            setMetric(creditsText, "Credits", "—", "same wallet as web + Mac");
            setMetric(agentsText, "Agents", "—", "same marketing agent identities");
            setMetric(runtimeText, "Tablet runtime", "Not connected", "sign in first");
            statusText.setText("");
        } else if (account != null) {
            String name = account.optString("full_name");
            if (name.isBlank()) name = account.optString("email", "Kryx founder");
            titleText.setText(name);
            detailText.setText(
                "Same Kryx account, same agents and credits. The tablet is a local executor, not a separate product."
            );
            setMetric(
                creditsText,
                "Credits",
                String.valueOf(account.optInt("credit_balance", 0)),
                "AI and paid tool work only"
            );

            int activeAgents = 0;
            for (int i = 0; i < agents.length(); i++) {
                JSONObject agent = agents.optJSONObject(i);
                if (
                    agent != null &&
                    "deployed".equals(agent.optString("status")) &&
                    !agent.optBoolean("paused", false)
                ) {
                    activeAgents++;
                }
            }
            setMetric(agentsText, "Agents", String.valueOf(activeAgents), "currently deployed");
            setMetric(
                runtimeText,
                "Tablet runtime",
                KryxAccessibilityService.isEnabled(this) ? "Connected" : "Account only",
                KryxAccessibilityService.isEnabled(this)
                    ? "local computer-use ready"
                    : "Accessibility still off"
            );
        }

        renderPermissionState();
    }

    private void setMetric(TextView view, String label, String value, String hint) {
        view.setText(label.toUpperCase() + "\n\n" + value + "\n" + hint);
    }

    private void renderPermissionState() {
        if (accessibilityButton == null) return;
        boolean enabled = KryxAccessibilityService.isEnabled(this);
        accessibilityButton.setText(enabled ? "Accessibility enabled" : "Enable Accessibility");
        accessibilityButton.setEnabled(!enabled);

        if (overlayButton != null) {
            boolean overlayPermission = Settings.canDrawOverlays(this);
            boolean floatingEnabled = secureStore.readState()
                .optBoolean("floatingControlEnabled", false);
            overlayButton.setEnabled(isSignedIn());
            overlayButton.setText(
                floatingEnabled && overlayPermission
                    ? "Turn off floating control"
                    : overlayPermission
                        ? "Turn on floating control"
                        : "Allow floating control"
            );
        }
        if (isSignedIn()) {
            setMetric(
                runtimeText,
                "Tablet runtime",
                enabled ? "Connected" : "Account only",
                enabled ? "local computer-use ready" : "Accessibility still off"
            );
        }
    }

    private void renderAllowedApps() {
        if (allowedAppsContainer == null) return;
        allowedAppsContainer.removeAllViews();

        Set<String> renderedPackages = new HashSet<>();
        for (Map.Entry<String, String> entry : commonApps.entrySet()) {
            if (!renderedPackages.add(entry.getValue())) continue;
            CheckBox box = new CheckBox(this);
            box.setText(entry.getKey());
            box.setTextSize(14);
            box.setTextColor(Color.rgb(39, 41, 45));
            box.setChecked(allowedApps.isAlwaysAllowed(entry.getValue()));
            box.setOnCheckedChangeListener((buttonView, checked) -> {
                allowedApps.setAllowed(entry.getValue(), checked);
                if (isSignedIn()) sendHeartbeat();
            });
            allowedAppsContainer.addView(box);
        }
    }

    private void renderObserverControls() {
        if (observerToggle == null || observerExcludedContainer == null) return;

        boolean enabled = ObserverRecorder.isEnabled(this);
        observerToggle.setChecked(enabled);
        observerToggle.setEnabled(isSignedIn());

        Set<String> excluded = ObserverRecorder.excludedApps(this);
        observerExcludedContainer.removeAllViews();

        Set<String> renderedObserverPackages = new HashSet<>();
        for (Map.Entry<String, String> entry : commonApps.entrySet()) {
            if (!renderedObserverPackages.add(entry.getValue())) continue;
            CheckBox box = new CheckBox(this);
            box.setText(entry.getKey());
            box.setTextSize(13);
            box.setTextColor(Color.rgb(72, 75, 80));
            box.setChecked(excluded.contains(entry.getValue()));
            box.setEnabled(isSignedIn());
            box.setOnCheckedChangeListener((button, checked) -> {
                if (!button.isPressed()) return;

                Set<String> next = new HashSet<>(ObserverRecorder.excludedApps(this));
                if (checked) next.add(entry.getValue());
                else next.remove(entry.getValue());

                updateObserverSettings(ObserverRecorder.isEnabled(this), next);
            });
            observerExcludedContainer.addView(box);
        }
    }

    private void updateObserverSettings(boolean enabled, Set<String> excluded) {
        if (!isSignedIn()) {
            statusText.setText("Connect your Kryx account before enabling Observer Mode.");
            renderObserverControls();
            return;
        }

        observerToggle.setEnabled(false);
        statusText.setText(enabled ? "Enabling Observer Mode…" : "Updating Observer privacy…");

        new Thread(() -> {
            try {
                ObserverRecorder.setEnabled(this, enabled, excluded, api);
                mainHandler.post(() -> {
                    statusText.setText(
                        enabled
                            ? "Observer Mode is on for allowed apps only."
                            : "Observer Mode is off."
                    );
                    renderObserverControls();
                });
            } catch (Exception error) {
                mainHandler.post(() -> {
                    fail("Could not sync Observer settings.", error);
                    renderObserverControls();
                });
            }
        }).start();
    }

    private boolean isSignedIn() {
        JSONObject state = secureStore.readState();
        return !state.optString("deviceRefreshToken", "").isBlank();
    }

    private void beginLogin() {
        loginButton.setEnabled(false);
        statusText.setText("Opening Kryx sign-in…");

        try {
            String verifier = randomUrlSafe(48);
            String stateValue = randomUrlSafe(32);
            String challenge = pkceChallenge(verifier);

            JSONObject body = new JSONObject()
                .put("installationId", secureStore.installationId())
                .put("deviceName", Build.MANUFACTURER + " " + Build.MODEL)
                .put("platform", "android")
                .put("osVersion", Build.VERSION.RELEASE)
                .put("appVersion", BuildConfig.VERSION_NAME)
                .put("state", stateValue)
                .put("codeChallenge", challenge)
                .put("redirectUri", "kryx://auth/callback")
                .put("publicKey", deviceKeyStore.publicKeyPem())
                .put(
                    "capabilities",
                    new JSONObject()
                        .put("accessibility_control", KryxAccessibilityService.isEnabled(this))
                        .put("browser_control", KryxAccessibilityService.isEnabled(this))
                        .put("screen_understanding", false)
                        .put("notifications", true)
                        .put("background_execution", true)
                        .put(
                            "floating_control",
                            Settings.canDrawOverlays(this) &&
                                secureStore.readState().optBoolean("floatingControlEnabled", false)
                        )
                )
                .put(
                    "permissions",
                    new JSONObject()
                        .put("accessibility", KryxAccessibilityService.isEnabled(this))
                        .put("allowedApps", new JSONArray(allowedApps.get()))
                        .put("floatingControl", Settings.canDrawOverlays(this))
                );

            api.post("/api/device/auth/start", body, new ApiClient.Callback() {
                @Override
                public void success(JSONObject data) {
                    mainHandler.post(() -> {
                        try {
                            JSONObject pending = new JSONObject()
                                .put("requestId", data.getString("requestId"))
                                .put("state", stateValue)
                                .put("codeVerifier", verifier)
                                .put("expiresAt", data.optString("expiresAt"));

                            JSONObject stored = secureStore.readState();
                            stored.put("pendingAuth", pending);
                            secureStore.writeState(stored);

                            Intent browser = new Intent(
                                Intent.ACTION_VIEW,
                                Uri.parse(data.getString("authorizeUrl"))
                            );
                            startActivity(browser);
                            statusText.setText("Finish sign-in in your browser, then return to Kryx.");
                        } catch (Exception error) {
                            fail("Could not save the sign-in request.", error);
                        } finally {
                            loginButton.setEnabled(true);
                        }
                    });
                }

                @Override
                public void failure(Exception error) {
                    mainHandler.post(() -> {
                        loginButton.setEnabled(true);
                        fail("Could not start Kryx sign-in.", error);
                    });
                }
            });
        } catch (Exception error) {
            loginButton.setEnabled(true);
            fail("Could not prepare secure sign-in.", error);
        }
    }

    private void handleDeepLink(Intent intent) {
        Uri uri = intent == null ? null : intent.getData();
        if (uri == null) return;
        if (
            !"kryx".equals(uri.getScheme()) ||
            !"auth".equals(uri.getHost()) ||
            !"/callback".equals(uri.getPath())
        ) {
            return;
        }

        JSONObject stored = secureStore.readState();
        JSONObject pending = stored.optJSONObject("pendingAuth");
        if (pending == null) {
            statusText.setText("This Kryx sign-in request is no longer active.");
            return;
        }

        String requestId = uri.getQueryParameter("request");
        String code = uri.getQueryParameter("code");
        String returnedState = uri.getQueryParameter("state");

        if (
            requestId == null ||
            code == null ||
            returnedState == null ||
            !requestId.equals(pending.optString("requestId")) ||
            !returnedState.equals(pending.optString("state"))
        ) {
            statusText.setText("Kryx blocked a sign-in callback that did not match this tablet.");
            return;
        }

        statusText.setText("Connecting this tablet to Kryx…");
        try {
            JSONObject body = new JSONObject()
                .put("requestId", requestId)
                .put("code", code)
                .put("state", returnedState)
                .put("codeVerifier", pending.getString("codeVerifier"));

            api.post("/api/device/auth/exchange", body, new ApiClient.Callback() {
                @Override
                public void success(JSONObject data) {
                    mainHandler.post(() -> {
                        try {
                            JSONObject next = secureStore.readState();
                            next.remove("pendingAuth");
                            next.put("deviceToken", data.getString("deviceToken"));
                            next.put("deviceRefreshToken", data.getString("deviceRefreshToken"));
                            next.put(
                                "deviceTokenExpiresAtMs",
                                Instant.parse(data.getString("deviceTokenExpiresAt")).toEpochMilli()
                            );
                            next.put(
                                "deviceRefreshExpiresAtMs",
                                Instant.parse(data.getString("deviceRefreshExpiresAt")).toEpochMilli()
                            );
                            next.put("device", data.optJSONObject("device"));
                            next.put(
                                "taskSigningPublicKeyB64",
                                data.getString("taskSigningPublicKeyB64")
                            );
                            secureStore.writeState(next);
                            loadAccount();
                            startHeartbeat();
                            startMissionRuntime();
                            startOverlayIfEnabled();
                            Toast.makeText(
                                MainActivity.this,
                                "Kryx connected to your existing account.",
                                Toast.LENGTH_SHORT
                            ).show();
                        } catch (Exception error) {
                            fail("Kryx connected, but the secure session could not be stored.", error);
                        }
                    });
                }

                @Override
                public void failure(Exception error) {
                    mainHandler.post(() -> fail("Desktop-style PKCE exchange failed.", error));
                }
            });
        } catch (Exception error) {
            fail("Could not finish Kryx sign-in.", error);
        }
    }

    private void loadAccount() {
        statusText.setText("Loading your Kryx account…");
        api.deviceGet("/api/device/me", new ApiClient.Callback() {
            @Override
            public void success(JSONObject data) {
                mainHandler.post(() -> {
                    account = data.optJSONObject("account");
                    JSONArray nextAgents = data.optJSONArray("agents");
                    agents = nextAgents == null ? new JSONArray() : nextAgents;
                    statusText.setText("Tablet connected.");
                    render();
                });
            }

            @Override
            public void failure(Exception error) {
                mainHandler.post(() -> fail("Could not load your Kryx account.", error));
            }
        });
    }

    private void startHeartbeat() {
        mainHandler.removeCallbacks(heartbeatRunnable);
        mainHandler.post(heartbeatRunnable);
    }

    private void sendHeartbeat() {
        if (!isSignedIn()) return;
        try {
            JSONObject body = new JSONObject()
                .put("appVersion", BuildConfig.VERSION_NAME)
                .put("osVersion", Build.VERSION.RELEASE)
                .put(
                    "capabilities",
                    new JSONObject()
                        .put("accessibility_control", KryxAccessibilityService.isEnabled(this))
                        .put("browser_control", KryxAccessibilityService.isEnabled(this))
                        .put("screen_understanding", false)
                        .put("notifications", true)
                        .put("background_execution", true)
                        .put(
                            "floating_control",
                            Settings.canDrawOverlays(this) &&
                                secureStore.readState().optBoolean("floatingControlEnabled", false)
                        )
                )
                .put(
                    "permissions",
                    new JSONObject()
                        .put("accessibility", KryxAccessibilityService.isEnabled(this))
                        .put("allowedApps", new JSONArray(allowedApps.get()))
                        .put("floatingControl", Settings.canDrawOverlays(this))
                );

            api.devicePost("/api/device/heartbeat", body, new ApiClient.Callback() {
                @Override public void success(JSONObject data) {}
                @Override public void failure(Exception error) {}
            });
        } catch (Exception ignored) {}
    }

    private void startMission() {
        String instruction = missionInput.getText().toString().trim();
        if (instruction.isBlank()) {
            statusText.setText("Describe the marketing job first.");
            return;
        }

        if (!KryxAccessibilityService.isEnabled(this)) {
            statusText.setText("Enable Accessibility before running a tablet mission.");
            return;
        }

        statusText.setText("Creating mission…");
        try {
            JSONObject stored = secureStore.readState();
            JSONObject device = stored.optJSONObject("device");
            if (device == null || device.optString("id", "").isBlank()) {
                statusText.setText("This tablet is not registered with Kryx.");
                return;
            }

            JSONObject body = new JSONObject()
                .put("instruction", instruction)
                .put("requestedExecution", "android");

            api.devicePost("/api/device/tasks", body, new ApiClient.Callback() {
                @Override
                public void success(JSONObject data) {
                    mainHandler.post(() -> {
                        missionInput.setText("");
                        statusText.setText(
                            "Mission queued. Kryx will only operate apps you allowed."
                        );
                    });
                }

                @Override
                public void failure(Exception error) {
                    mainHandler.post(() -> fail("Mission could not be created.", error));
                }
            });
        } catch (Exception error) {
            fail("Mission could not be prepared.", error);
        }
    }

    private void disconnect() {
        disconnectButton.setEnabled(false);
        statusText.setText("Disconnecting this tablet…");

        api.devicePost("/api/device/revoke", new JSONObject(), new ApiClient.Callback() {
            @Override
            public void success(JSONObject data) {
                mainHandler.post(() -> clearLocalSession("Tablet disconnected."));
            }

            @Override
            public void failure(Exception error) {
                mainHandler.post(() -> clearLocalSession(
                    "Local session cleared. Web revoke may still be needed if the network failed."
                ));
            }
        });
    }

    private void clearLocalSession(String message) {
        stopService(new Intent(this, KryxMissionService.class));
        stopService(new Intent(this, KryxOverlayService.class));
        secureStore.clearState();
        account = null;
        agents = new JSONArray();
        mainHandler.removeCallbacks(heartbeatRunnable);
        disconnectButton.setEnabled(true);
        statusText.setText(message);
        render();
    }

    private void toggleFloatingControl() {
        if (!isSignedIn()) {
            statusText.setText("Connect your Kryx account before enabling floating control.");
            return;
        }

        if (!Settings.canDrawOverlays(this)) {
            try {
                JSONObject state = secureStore.readState();
                state.put("floatingControlRequested", true);
                secureStore.writeState(state);
            } catch (Exception ignored) {}

            Intent intent = new Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:" + getPackageName())
            );
            startActivity(intent);
            return;
        }

        try {
            JSONObject state = secureStore.readState();
            boolean enabled = state.optBoolean("floatingControlEnabled", false);
            state.put("floatingControlEnabled", !enabled);
            secureStore.writeState(state);

            if (enabled) {
                stopService(new Intent(this, KryxOverlayService.class));
                statusText.setText("Floating control is off.");
            } else {
                startService(new Intent(this, KryxOverlayService.class));
                statusText.setText("Floating Kryx control is on.");
            }
            renderPermissionState();
            sendHeartbeat();
        } catch (Exception error) {
            fail("Could not update floating control.", error);
        }
    }

    private void completePendingOverlayPermission() {
        JSONObject state = secureStore.readState();
        if (
            state.optBoolean("floatingControlRequested", false) &&
            Settings.canDrawOverlays(this)
        ) {
            try {
                state.put("floatingControlRequested", false);
                state.put("floatingControlEnabled", true);
                secureStore.writeState(state);
                startService(new Intent(this, KryxOverlayService.class));
            } catch (Exception ignored) {}
        }
    }

    private void startOverlayIfEnabled() {
        JSONObject state = secureStore.readState();
        if (
            state.optBoolean("floatingControlEnabled", false) &&
            Settings.canDrawOverlays(this)
        ) {
            startService(new Intent(this, KryxOverlayService.class));
        }
    }

    private void startMissionRuntime() {
        if (!isSignedIn()) return;
        Intent runtime = new Intent(this, KryxMissionService.class);
        startForegroundService(runtime);
    }

    private void requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= 33) {
            if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) !=
                android.content.pm.PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 401);
            }
        }
    }

    private void fail(String prefix, Exception error) {
        String message = error == null ? prefix : prefix + " " + error.getMessage();
        statusText.setText(message);
    }

    private static String randomUrlSafe(int bytes) {
        byte[] value = new byte[bytes];
        new SecureRandom().nextBytes(value);
        return Base64.encodeToString(
            value,
            Base64.URL_SAFE | Base64.NO_WRAP | Base64.NO_PADDING
        );
    }

    private static String pkceChallenge(String verifier) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] hash = digest.digest(verifier.getBytes(StandardCharsets.US_ASCII));
        return Base64.encodeToString(
            hash,
            Base64.URL_SAFE | Base64.NO_WRAP | Base64.NO_PADDING
        );
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
