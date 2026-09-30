package ai.kryx.tablet.security;

import android.content.Context;
import android.content.SharedPreferences;

import java.util.Collections;
import java.util.HashSet;
import java.util.Set;

public final class AllowedAppsStore {
    private static final String PREFS = "kryx_allowed_apps";
    private static final String KEY = "packages";

    private final SharedPreferences prefs;

    public AllowedAppsStore(Context context) {
        prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public Set<String> get() {
        return Collections.unmodifiableSet(
            new HashSet<>(prefs.getStringSet(KEY, Collections.emptySet()))
        );
    }

    public boolean isAllowed(String packageName) {
        return packageName != null && get().contains(packageName);
    }

    public void setAllowed(String packageName, boolean allowed) {
        Set<String> next = new HashSet<>(prefs.getStringSet(KEY, Collections.emptySet()));
        if (allowed) next.add(packageName);
        else next.remove(packageName);
        prefs.edit().putStringSet(KEY, next).apply();
    }
}
