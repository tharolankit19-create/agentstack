package ai.kryx.tablet.approval;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;

import ai.kryx.tablet.security.AllowedAppsStore;
import ai.kryx.tablet.security.SecureStore;

import org.json.JSONObject;

public final class AppOpenApproval {
    public static final String CHANNEL_ID = "kryx_app_approval";
    public static final String ACTION_ONCE = "ai.kryx.tablet.APPROVE_ONCE";
    public static final String ACTION_ALWAYS = "ai.kryx.tablet.APPROVE_ALWAYS";
    public static final String ACTION_REJECT = "ai.kryx.tablet.REJECT_APP";

    private AppOpenApproval() {}

    public static boolean isApprovedNow(
        Context context,
        String taskId,
        String packageName
    ) throws Exception {
        AllowedAppsStore allowed = new AllowedAppsStore(context);
        if (allowed.isAlwaysAllowed(packageName)) return true;
        if (allowed.isAllowed(packageName)) return true;

        SecureStore store = new SecureStore(context);
        JSONObject state = store.readState();
        JSONObject pending = state.optJSONObject("pendingAppApproval");
        if (pending == null) return false;
        if (!taskId.equals(pending.optString("taskId"))) return false;
        if (!packageName.equals(pending.optString("packageName"))) return false;

        String decision = pending.optString("decision", "");
        if ("once".equals(decision)) {
            allowed.grantTemporary(packageName, 15 * 60_000L);
            state.remove("pendingAppApproval");
            store.writeState(state);
            return true;
        }

        if ("always".equals(decision)) {
            allowed.setAllowed(packageName, true);
            state.remove("pendingAppApproval");
            store.writeState(state);
            return true;
        }

        if ("reject".equals(decision)) {
            state.remove("pendingAppApproval");
            store.writeState(state);
            throw new SecurityException("Founder rejected opening this app.");
        }

        return false;
    }

    public static void request(
        Context context,
        String taskId,
        String packageName,
        String appLabel
    ) throws Exception {
        SecureStore store = new SecureStore(context);
        JSONObject state = store.readState();
        JSONObject existing = state.optJSONObject("pendingAppApproval");

        if (
            existing != null &&
            taskId.equals(existing.optString("taskId")) &&
            packageName.equals(existing.optString("packageName")) &&
            existing.optString("decision", "").isBlank()
        ) {
            return;
        }

        state.put(
            "pendingAppApproval",
            new JSONObject()
                .put("taskId", taskId)
                .put("packageName", packageName)
                .put("appLabel", appLabel)
                .put("decision", "")
                .put("requestedAt", System.currentTimeMillis())
        );
        store.writeState(state);

        NotificationManager manager =
            (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "Kryx app approvals",
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("Approval before Kryx opens an app.");
        manager.createNotificationChannel(channel);

        PendingIntent once = action(context, ACTION_ONCE, taskId, packageName, 7101);
        PendingIntent always = action(context, ACTION_ALWAYS, taskId, packageName, 7102);
        PendingIntent reject = action(context, ACTION_REJECT, taskId, packageName, 7103);

        android.app.Notification notification =
            new android.app.Notification.Builder(context, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.stat_sys_warning)
                .setContentTitle("Allow Kryx to open " + appLabel + "?")
                .setContentText("This mission is waiting for your approval.")
                .setStyle(
                    new android.app.Notification.BigTextStyle().bigText(
                        "Kryx will not open " + appLabel +
                        " until you approve. “Always allow” applies only to this app."
                    )
                )
                .addAction(new android.app.Notification.Action.Builder(null, "Allow once", once).build())
                .addAction(new android.app.Notification.Action.Builder(null, "Always allow", always).build())
                .addAction(new android.app.Notification.Action.Builder(null, "Reject", reject).build())
                .setAutoCancel(false)
                .setOnlyAlertOnce(true)
                .build();

        manager.notify(notificationId(taskId), notification);
    }

    static int notificationId(String taskId) {
        return 20000 + Math.abs(taskId.hashCode() % 10000);
    }

    private static PendingIntent action(
        Context context,
        String action,
        String taskId,
        String packageName,
        int salt
    ) {
        Intent intent = new Intent(context, AppApprovalReceiver.class)
            .setAction(action)
            .putExtra("taskId", taskId)
            .putExtra("packageName", packageName);

        return PendingIntent.getBroadcast(
            context,
            salt ^ taskId.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }
}
