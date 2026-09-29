package ai.kryx.tablet.net;

import ai.kryx.tablet.BuildConfig;
import ai.kryx.tablet.security.SecureStore;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class ApiClient {
    public interface Callback {
        void success(JSONObject data);
        void failure(Exception error);
    }

    private final SecureStore secureStore;
    private final ExecutorService executor = Executors.newCachedThreadPool();

    public ApiClient(SecureStore secureStore) {
        this.secureStore = secureStore;
    }

    public void post(String path, JSONObject body, Callback callback) {
        executor.execute(() -> {
            try {
                callback.success(request("POST", path, body, null));
            } catch (Exception error) {
                callback.failure(error);
            }
        });
    }

    public void deviceGet(String path, Callback callback) {
        executor.execute(() -> {
            try {
                ensureFreshSession();
                JSONObject state = secureStore.readState();
                String token = state.optString("deviceToken", "");
                if (token.isBlank()) throw new IllegalStateException("Kryx device is not signed in.");
                callback.success(request("GET", path, null, "Device " + token));
            } catch (Exception error) {
                callback.failure(error);
            }
        });
    }

    public void devicePost(String path, JSONObject body, Callback callback) {
        executor.execute(() -> {
            try {
                ensureFreshSession();
                JSONObject state = secureStore.readState();
                String token = state.optString("deviceToken", "");
                if (token.isBlank()) throw new IllegalStateException("Kryx device is not signed in.");
                callback.success(request("POST", path, body, "Device " + token));
            } catch (Exception error) {
                callback.failure(error);
            }
        });
    }

    private synchronized void ensureFreshSession() throws Exception {
        JSONObject state = secureStore.readState();
        String refresh = state.optString("deviceRefreshToken", "");
        long expiresAt = state.optLong("deviceTokenExpiresAtMs", 0L);

        if (expiresAt > System.currentTimeMillis() + 120_000L) return;
        if (refresh.isBlank()) throw new IllegalStateException("Kryx device session expired.");

        JSONObject rotated = request(
            "POST",
            "/api/device/session",
            new JSONObject(),
            "Device-Refresh " + refresh
        );

        state.put("deviceToken", rotated.getString("deviceToken"));
        state.put("deviceRefreshToken", rotated.getString("deviceRefreshToken"));
        state.put(
            "deviceTokenExpiresAtMs",
            java.time.Instant.parse(rotated.getString("deviceTokenExpiresAt")).toEpochMilli()
        );
        state.put(
            "deviceRefreshExpiresAtMs",
            java.time.Instant.parse(rotated.getString("deviceRefreshExpiresAt")).toEpochMilli()
        );
        secureStore.writeState(state);
    }

    private JSONObject request(
        String method,
        String path,
        JSONObject body,
        String authorization
    ) throws Exception {
        URL url = new URL(BuildConfig.KRYX_API_URL.replaceAll("/+$", "") + path);
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setRequestMethod(method);
        connection.setConnectTimeout(15_000);
        connection.setReadTimeout(30_000);
        connection.setRequestProperty("Accept", "application/json");
        connection.setRequestProperty("Content-Type", "application/json");
        connection.setRequestProperty("User-Agent", "KryxTablet/" + BuildConfig.VERSION_NAME);
        connection.setRequestProperty("Cache-Control", "no-store");
        if (authorization != null) {
            connection.setRequestProperty("Authorization", authorization);
        }

        if (body != null && !"GET".equals(method)) {
            connection.setDoOutput(true);
            try (OutputStream output = connection.getOutputStream()) {
                output.write(body.toString().getBytes(StandardCharsets.UTF_8));
            }
        }

        int status = connection.getResponseCode();
        InputStream stream = status >= 200 && status < 300
            ? connection.getInputStream()
            : connection.getErrorStream();
        String raw = readAll(stream);
        JSONObject payload = raw.isBlank() ? new JSONObject() : new JSONObject(raw);

        if (status < 200 || status >= 300) {
            throw new IllegalStateException(
                payload.optString("error", "Kryx returned HTTP " + status)
            );
        }
        return payload;
    }

    private static String readAll(InputStream stream) throws Exception {
        if (stream == null) return "";
        try (BufferedReader reader = new BufferedReader(
            new InputStreamReader(stream, StandardCharsets.UTF_8)
        )) {
            StringBuilder builder = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) builder.append(line);
            return builder.toString();
        }
    }
}
