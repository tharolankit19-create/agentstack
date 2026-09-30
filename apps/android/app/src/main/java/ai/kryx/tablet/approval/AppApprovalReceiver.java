package ai.kryx.tablet.approval;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import ai.kryx.tablet.runtime.KryxMissionService;
import ai.kryx.tablet.security.SecureStore;

import org.json.JSONObject;

public final class AppApprovalReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String taskId = intent.getStringExtra("taskId");
        String packageName = intent.getStringExtra("packageName");
        if (taskId == null || packageName == null) return;

        String decision;
        if (AppOpenApproval.ACTION_ONCE.equals(intent.getAction())) {
            decision = "once";
        } else if (AppOpenApproval.ACTION_ALWAYS.equals(intent.getAction())) {
            decision = "always";
        } else {
            decision = "reject";
        }

        try {
            SecureStore store = new SecureStore(context);
            JSONObject state = store.readState();
            JSONObject pending = state.optJSONObject("pendingAppApproval");
            if (
                pending == null ||
                !taskId.equals(pending.optString("taskId")) ||
                !packageName.equals(pending.optString("packageName"))
            ) {
                return;
            }

            pending.put("decision", decision);
            state.put("pendingAppApproval", pending);
            store.writeState(state);

            NotificationManager manager =
                (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            manager.cancel(AppOpenApproval.notificationId(taskId));

            Intent service = new Intent(context, KryxMissionService.class);
            context.startForegroundService(service);
        } catch (Exception ignored) {}
    }
}
