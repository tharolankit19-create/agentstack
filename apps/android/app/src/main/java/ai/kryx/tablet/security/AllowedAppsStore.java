package ai.kryx.tablet.security;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONObject;

import java.util.Collections;
import java.util.HashSet;
import java.util.Set;

public final class AllowedAppsStore {
    private static final String PREFS = "kryx_allowed_apps";
    private static final String KEY = "packages";
    private static final String TEMP_PREFIX = "temp:";

    private final SharedPreferences prefs;

    public AllowedAppsStore(Context context) {
        prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public Set<String> get() {
        return Collections.unmodifiableSet(
            new HashSet<>(prefs.getStringSet(KEY, Collections.emptySet()))
        );
    }

    public boolean isAlwaysAllowed(String packageName) {
        return packageName != null && get().contains(packageName);
    }

    public boolean isAllowed(String packageName) {
        if (packageName == null) return false;
        if (isAlwaysAllowed(packageName)) return true;

        long expiresAt = prefs.getLong(TEMP_PREFIX + packageName, 0L);
        if (expiresAt > System.currentTimeMillis()) return true;

        if (expiresAt > 0L) prefs.edit().remove(TEMP_PREFIX + packageName).apply();
        return false;
    }

    public void grantTemporary(String packageName, long durationMs) {
        if (packageName == null || packageName.isBlank()) return;
        prefs.edit()
            .putLong(
                TEMP_PREFIX + packageName,
                System.currentTimeMillis() + Math.max(60_000L, durationMs)
            )
            .apply();
    }

    public void clearTemporary(String packageName) {
        if (packageName == null) return;
        prefs.edit().remove(TEMP_PREFIX + packageName).apply();
    }

    public void setAllowed(String packageName, boolean allowed) {
        Set<String> next = new HashSet<>(prefs.getStringSet(KEY, Collections.emptySet()));
        if (allowed) next.add(packageName);
        else next.remove(packageName);
        prefs.edit().putStringSet(KEY, next).apply();
        if (!allowed) clearTemporary(packageName);
    }
}
