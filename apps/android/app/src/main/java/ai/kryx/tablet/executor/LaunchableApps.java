package ai.kryx.tablet.executor;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

public final class LaunchableApps {
    private LaunchableApps() {}

    public static Map<String, String> list(Context context) {
        PackageManager packageManager = context.getPackageManager();
        Intent launcher = new Intent(Intent.ACTION_MAIN);
        launcher.addCategory(Intent.CATEGORY_LAUNCHER);

        List<ResolveInfo> resolved = packageManager.queryIntentActivities(
            launcher,
            PackageManager.ResolveInfoFlags.of(0)
        );

        List<App> apps = new ArrayList<>();
        for (ResolveInfo info : resolved) {
            if (info.activityInfo == null || info.activityInfo.packageName == null) continue;
            String packageName = info.activityInfo.packageName;
            if (context.getPackageName().equals(packageName)) continue;

            CharSequence labelValue = info.loadLabel(packageManager);
            String label = labelValue == null || labelValue.toString().isBlank()
                ? packageName
                : labelValue.toString().trim();
            apps.add(new App(label, packageName));
        }

        apps.sort(
            Comparator.comparing(
                app -> app.label.toLowerCase(Locale.ROOT)
            )
        );

        Map<String, String> unique = new LinkedHashMap<>();
        for (App app : apps) {
            String display = app.label;
            if (unique.containsKey(display)) display = display + " · " + app.packageName;
            unique.put(display, app.packageName);
        }
        return unique;
    }

    public static String resolvePackage(Context context, String instruction) {
        String normalized = instruction == null
            ? ""
            : instruction.toLowerCase(Locale.ROOT);

        String bestPackage = null;
        int bestLength = 0;

        for (Map.Entry<String, String> entry : list(context).entrySet()) {
            String label = entry.getKey().toLowerCase(Locale.ROOT);
            String simpleLabel = label.split(" · ")[0].trim();

            if (simpleLabel.length() >= 2 && normalized.contains(simpleLabel)) {
                if (simpleLabel.length() > bestLength) {
                    bestLength = simpleLabel.length();
                    bestPackage = entry.getValue();
                }
            }

            String packageName = entry.getValue().toLowerCase(Locale.ROOT);
            if (normalized.contains(packageName) && packageName.length() > bestLength) {
                bestLength = packageName.length();
                bestPackage = entry.getValue();
            }
        }

        if (bestPackage != null) return bestPackage;

        if (containsAny(normalized, "twitter", " x ", "x app", "x dm", "x message")) {
            return installed(context, "com.twitter.android") ? "com.twitter.android" : null;
        }
        if (containsAny(normalized, "gmail", "email", "inbox")) {
            return installed(context, "com.google.android.gm") ? "com.google.android.gm" : null;
        }
        if (containsAny(normalized, "linkedin")) {
            return installed(context, "com.linkedin.android") ? "com.linkedin.android" : null;
        }
        if (containsAny(normalized, "telegram")) {
            return installed(context, "org.telegram.messenger") ? "org.telegram.messenger" : null;
        }
        if (containsAny(normalized, "slack")) {
            return installed(context, "com.Slack") ? "com.Slack" : null;
        }
        if (containsAny(normalized, "notion")) {
            return installed(context, "notion.id") ? "notion.id" : null;
        }
        return null;
    }

    public static String appLabel(Context context, String packageName) {
        try {
            PackageManager packageManager = context.getPackageManager();
            CharSequence label = packageManager.getApplicationLabel(
                packageManager.getApplicationInfo(packageName, 0)
            );
            return label == null ? packageName : label.toString();
        } catch (Exception ignored) {
            return packageName;
        }
    }

    private static boolean installed(Context context, String packageName) {
        return context.getPackageManager().getLaunchIntentForPackage(packageName) != null;
    }

    private static boolean containsAny(String value, String... needles) {
        for (String needle : needles) {
            if (value.contains(needle)) return true;
        }
        return false;
    }

    private record App(String label, String packageName) {}
}
