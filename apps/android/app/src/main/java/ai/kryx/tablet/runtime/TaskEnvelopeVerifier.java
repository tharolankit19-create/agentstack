package ai.kryx.tablet.runtime;

import android.util.Base64;

import ai.kryx.tablet.BuildConfig;
import ai.kryx.tablet.security.SecureStore;

import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.X509EncodedKeySpec;
import java.time.Instant;

public final class TaskEnvelopeVerifier {
    private static final String KEY_ID = "kryx-device-v1";

    private final SecureStore secureStore;

    public TaskEnvelopeVerifier(SecureStore secureStore) {
        this.secureStore = secureStore;
    }

    public JSONObject verify(JSONObject envelope) throws Exception {
        if (!"Ed25519".equals(envelope.optString("alg"))) {
            throw new SecurityException("Unsupported Kryx task signature algorithm.");
        }
        if (!KEY_ID.equals(envelope.optString("kid"))) {
            throw new SecurityException("Unknown Kryx task signing key.");
        }

        JSONObject localState = secureStore.readState();
        String pinnedBuildKey = BuildConfig.KRYX_TASK_SIGNING_PUBLIC_KEY_B64.trim();
        String enrolledKey = localState.optString("taskSigningPublicKeyB64", "").trim();

        String keyB64 = !pinnedBuildKey.isBlank() ? pinnedBuildKey : enrolledKey;
        if (keyB64.isBlank()) {
            throw new SecurityException(
                "This tablet has no trusted Kryx task verification key. Reconnect the device."
            );
        }
        if (!pinnedBuildKey.isBlank() && !enrolledKey.isBlank() && !pinnedBuildKey.equals(enrolledKey)) {
            throw new SecurityException("Kryx task signing identity changed unexpectedly.");
        }

        byte[] payloadBytes = decodeUrl(envelope.getString("payload"));
        byte[] signatureBytes = decodeUrl(envelope.getString("signature"));

        PublicKey publicKey = KeyFactory.getInstance("Ed25519").generatePublic(
            new X509EncodedKeySpec(Base64.decode(keyB64, Base64.DEFAULT))
        );
        Signature verifier = Signature.getInstance("Ed25519");
        verifier.initVerify(publicKey);
        verifier.update(payloadBytes);

        if (!verifier.verify(signatureBytes)) {
            throw new SecurityException("Kryx task signature verification failed.");
        }

        JSONObject payload = new JSONObject(
            new String(payloadBytes, StandardCharsets.UTF_8)
        );

        if (payload.optInt("version", 0) != 1) {
            throw new SecurityException("Unsupported Kryx task envelope version.");
        }

        Instant expiresAt = Instant.parse(payload.getString("expires_at"));
        if (!expiresAt.isAfter(Instant.now())) {
            throw new SecurityException("Kryx task envelope expired.");
        }

        JSONObject local = localState;
        JSONObject device = local.optJSONObject("device");
        String deviceId = device == null ? "" : device.optString("id", "");

        if (deviceId.isBlank() || !deviceId.equals(payload.optString("device_id"))) {
            throw new SecurityException("Task was signed for a different Kryx device.");
        }

        return payload;
    }

    private static byte[] decodeUrl(String value) {
        return Base64.decode(
            value,
            Base64.URL_SAFE | Base64.NO_WRAP | Base64.NO_PADDING
        );
    }
}
