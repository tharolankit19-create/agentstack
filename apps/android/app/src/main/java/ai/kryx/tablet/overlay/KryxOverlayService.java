package ai.kryx.tablet.overlay;

import android.app.Service;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.os.IBinder;
import android.provider.Settings;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.view.inputmethod.InputMethodManager;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import ai.kryx.tablet.net.ApiClient;
import ai.kryx.tablet.runtime.KryxMissionService;
import ai.kryx.tablet.security.SecureStore;

import org.json.JSONObject;

public final class KryxOverlayService extends Service {
    private WindowManager windowManager;
    private View bubble;
    private View panel;
    private WindowManager.LayoutParams bubbleParams;

    @Override
    public void onCreate() {
        super.onCreate();

        if (!Settings.canDrawOverlays(this)) {
            stopSelf();
            return;
        }

        SecureStore store = new SecureStore(this);
        if (store.readState().optString("deviceRefreshToken", "").isBlank()) {
            stopSelf();
            return;
        }

        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        createBubble();
    }

    private void createBubble() {
        TextView pill = new TextView(this);
        pill.setText("K");
        pill.setGravity(Gravity.CENTER);
        pill.setTextSize(18);
        pill.setTypeface(pill.getTypeface(), android.graphics.Typeface.BOLD);
        pill.setTextColor(Color.WHITE);
        pill.setElevation(dp(10));

        GradientDrawable background = new GradientDrawable();
        background.setShape(GradientDrawable.OVAL);
        background.setColor(Color.rgb(20, 21, 24));
        background.setStroke(dp(1), Color.rgb(65, 68, 74));
        pill.setBackground(background);

        bubbleParams = new WindowManager.LayoutParams(
            dp(54),
            dp(54),
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE |
                WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
        );
        bubbleParams.gravity = Gravity.TOP | Gravity.END;
        bubbleParams.x = dp(18);
        bubbleParams.y = dp(160);

        pill.setOnTouchListener(new View.OnTouchListener() {
            float downX;
            float downY;
            int startX;
            int startY;
            boolean moved;

            @Override
            public boolean onTouch(View view, MotionEvent event) {
                switch (event.getActionMasked()) {
                    case MotionEvent.ACTION_DOWN -> {
                        downX = event.getRawX();
                        downY = event.getRawY();
                        startX = bubbleParams.x;
                        startY = bubbleParams.y;
                        moved = false;
                        return true;
                    }
                    case MotionEvent.ACTION_MOVE -> {
                        float dx = event.getRawX() - downX;
                        float dy = event.getRawY() - downY;
                        if (Math.abs(dx) > dp(4) || Math.abs(dy) > dp(4)) moved = true;
                        bubbleParams.x = Math.max(0, startX - Math.round(dx));
                        bubbleParams.y = Math.max(0, startY + Math.round(dy));
                        windowManager.updateViewLayout(bubble, bubbleParams);
                        return true;
                    }
                    case MotionEvent.ACTION_UP -> {
                        if (!moved) togglePanel();
                        return true;
                    }
                    default -> {
                        return false;
                    }
                }
            }
        });

        bubble = pill;
        windowManager.addView(bubble, bubbleParams);
    }

    private void togglePanel() {
        if (panel != null) {
            closePanel();
            return;
        }

        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(14), dp(12), dp(14), dp(12));
        card.setElevation(dp(14));

        GradientDrawable cardBackground = new GradientDrawable();
        cardBackground.setCornerRadius(dp(18));
        cardBackground.setColor(Color.rgb(22, 23, 26));
        cardBackground.setStroke(dp(1), Color.rgb(61, 64, 70));
        card.setBackground(cardBackground);

        TextView title = new TextView(this);
        title.setText("Kryx");
        title.setTextColor(Color.WHITE);
        title.setTextSize(16);
        title.setTypeface(title.getTypeface(), android.graphics.Typeface.BOLD);
        card.addView(title);

        TextView hint = new TextView(this);
        hint.setText("Give Kryx a marketing task on this device.");
        hint.setTextColor(Color.rgb(172, 176, 184));
        hint.setTextSize(12);
        hint.setPadding(0, dp(3), 0, dp(9));
        card.addView(hint);

        EditText input = new EditText(this);
        input.setHint("e.g. Open X and summarize today's relevant activity");
        input.setTextColor(Color.WHITE);
        input.setHintTextColor(Color.rgb(123, 127, 134));
        input.setTextSize(14);
        input.setMinHeight(dp(74));
        input.setMaxLines(4);
        input.setPadding(dp(10), dp(9), dp(10), dp(9));

        GradientDrawable inputBackground = new GradientDrawable();
        inputBackground.setCornerRadius(dp(10));
        inputBackground.setColor(Color.rgb(12, 13, 15));
        inputBackground.setStroke(dp(1), Color.rgb(54, 57, 63));
        input.setBackground(inputBackground);
        card.addView(
            input,
            new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        );

        LinearLayout actions = new LinearLayout(this);
        actions.setOrientation(LinearLayout.HORIZONTAL);
        actions.setGravity(Gravity.END);
        actions.setPadding(0, dp(9), 0, 0);

        Button close = new Button(this);
        close.setText("Close");
        close.setAllCaps(false);
        close.setOnClickListener(v -> closePanel());
        actions.addView(close);

        Button send = new Button(this);
        send.setText("Run");
        send.setAllCaps(false);
        send.setOnClickListener(v -> submit(input, send));
        actions.addView(send);

        card.addView(actions);

        WindowManager.LayoutParams panelParams = new WindowManager.LayoutParams(
            dp(340),
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
        );
        panelParams.gravity = Gravity.TOP | Gravity.END;
        panelParams.x = dp(18);
        panelParams.y = Math.max(dp(72), bubbleParams.y + dp(62));

        panel = card;
        windowManager.addView(panel, panelParams);
        input.requestFocus();

        InputMethodManager keyboard =
            (InputMethodManager) getSystemService(INPUT_METHOD_SERVICE);
        keyboard.showSoftInput(input, InputMethodManager.SHOW_IMPLICIT);
    }

    private void submit(EditText input, Button send) {
        String instruction = input.getText().toString().trim();
        if (instruction.isBlank()) return;

        send.setEnabled(false);
        send.setText("Starting…");

        ApiClient api = new ApiClient(new SecureStore(this));

        try {
            JSONObject body = new JSONObject()
                .put("instruction", instruction)
                .put("requestedExecution", "android");

            api.devicePost("/api/device/tasks", body, new ApiClient.Callback() {
                @Override
                public void success(JSONObject data) {
                    new android.os.Handler(getMainLooper()).post(() -> {
                        Toast.makeText(
                            KryxOverlayService.this,
                            "Kryx mission started.",
                            Toast.LENGTH_SHORT
                        ).show();

                        Intent runtime = new Intent(
                            KryxOverlayService.this,
                            KryxMissionService.class
                        );
                        startForegroundService(runtime);
                        closePanel();
                    });
                }

                @Override
                public void failure(Exception error) {
                    new android.os.Handler(getMainLooper()).post(() -> {
                        send.setEnabled(true);
                        send.setText("Run");
                        Toast.makeText(
                            KryxOverlayService.this,
                            error.getMessage() == null
                                ? "Could not start Kryx mission."
                                : error.getMessage(),
                            Toast.LENGTH_LONG
                        ).show();
                    });
                }
            });
        } catch (Exception error) {
            send.setEnabled(true);
            send.setText("Run");
        }
    }

    private void closePanel() {
        if (panel == null || windowManager == null) return;
        try {
            windowManager.removeView(panel);
        } catch (Exception ignored) {}
        panel = null;
    }

    @Override
    public void onDestroy() {
        closePanel();
        if (bubble != null && windowManager != null) {
            try {
                windowManager.removeView(bubble);
            } catch (Exception ignored) {}
        }
        bubble = null;
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
