package ai.kryx.tablet.quick;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Person;
import android.content.Context;
import android.content.Intent;
import android.graphics.drawable.Icon;
import android.os.Build;

import ai.kryx.tablet.MainActivity;

public final class QuickAccessNotification {
    private static final String CHANNEL_ID = "kryx_quick_access";
    private static final int NOTIFICATION_ID = 8841;

    private QuickAccessNotification() {}

    public static void setEnabled(Context context, boolean enabled) {
        NotificationManager manager =
            (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);

        if (!enabled) {
            manager.cancel(NOTIFICATION_ID);
            return;
        }

        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "Kryx quick access",
            NotificationManager.IMPORTANCE_DEFAULT
        );
        channel.setDescription("Open Kryx quickly while you work.");
        if (Build.VERSION.SDK_INT >= 29) channel.setAllowBubbles(true);
        manager.createNotificationChannel(channel);

        Intent open = new Intent(context, MainActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);

        PendingIntent pending = PendingIntent.getActivity(
            context,
            8841,
            open,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Notification.Builder builder = new Notification.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("Kryx")
            .setContentText("Tap to give Kryx a task")
            .setContentIntent(pending)
            .setAutoCancel(false)
            .setOngoing(false)
            .setCategory(Notification.CATEGORY_MESSAGE)
            .setOnlyAlertOnce(true);

        if (Build.VERSION.SDK_INT >= 29) {
            Person person = new Person.Builder()
                .setName("Kryx")
                .setImportant(true)
                .build();

            Notification.BubbleMetadata bubble =
                new Notification.BubbleMetadata.Builder(
                    pending,
                    Icon.createWithResource(context, android.R.drawable.ic_dialog_info)
                )
                .setDesiredHeight(620)
                .setAutoExpandBubble(false)
                .setSuppressNotification(false)
                .build();

            builder
                .setBubbleMetadata(bubble)
                .addPerson(person);
        }

        manager.notify(NOTIFICATION_ID, builder.build());
    }
}
