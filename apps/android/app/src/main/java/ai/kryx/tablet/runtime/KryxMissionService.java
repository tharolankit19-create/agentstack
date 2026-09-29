package ai.kryx.tablet.runtime;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.os.IBinder;

import ai.kryx.tablet.MainActivity;
import ai.kryx.tablet.security.SecureStore;

import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

public final class KryxMissionService extends Service {
    public static final String CHANNEL_ID = "kryx_background_runtime";
    private static final int NOTIFICATION_ID = 1201;

    private ScheduledExecutorService scheduler;
    private final AtomicBoolean busy = new AtomicBoolean(false);

    @Override
    public void onCreate() {
        super.onCreate();
        ensureChannel();
        startForeground(NOTIFICATION_ID, notification("Kryx is ready", "Waiting for a marketing job."));

        scheduler = Executors.newSingleThreadScheduledExecutor();
        scheduler.scheduleWithFixedDelay(this::pollSafely, 2, 25, TimeUnit.SECONDS);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        return START_STICKY;
    }

    private void pollSafely() {
        if (!busy.compareAndSet(false, true)) return;

        try {
            SecureStore store = new SecureStore(this);
            if (store.readState().optString("deviceRefreshToken", "").isBlank()) {
                stopSelf();
                return;
            }

            updateNotification("Kryx is ready", "Checking for assigned marketing work…");
            TaskRunner runner = new TaskRunner(this);
            boolean ran = runner.pollOnce();

            updateNotification(
                ran ? "Kryx finished local work" : "Kryx is ready",
                ran ? "Results are syncing to your Kryx mission." : "Waiting for a marketing job."
            );
        } catch (SecurityException error) {
            updateNotification("Kryx blocked a task", safe(error));
        } catch (Exception error) {
            // Network/offline errors are not task completion. Keep the runtime
            // alive and retry on the next bounded poll rather than spinning.
            updateNotification("Kryx is waiting", safe(error));
        } finally {
            busy.set(false);
        }
    }

    @Override
    public void onDestroy() {
        if (scheduler != null) scheduler.shutdownNow();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private Notification notification(String title, String body) {
        Intent open = new Intent(this, MainActivity.class);
        PendingIntent pending = PendingIntent.getActivity(
            this,
            0,
            open,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        return new Notification.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.stat_notify_sync)
            .setContentTitle(title)
            .setContentText(body)
            .setContentIntent(pending)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .build();
    }

    private void updateNotification(String title, String body) {
        NotificationManager manager =
            (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        manager.notify(NOTIFICATION_ID, notification(title, body));
    }

    private void ensureChannel() {
        NotificationManager manager =
            (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "Kryx background missions",
            NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("Visible while Kryx can receive and run tablet marketing missions.");
        manager.createNotificationChannel(channel);
    }

    private static String safe(Exception error) {
        String message = error.getMessage();
        return message == null || message.isBlank()
            ? error.getClass().getSimpleName()
            : message;
    }
}
