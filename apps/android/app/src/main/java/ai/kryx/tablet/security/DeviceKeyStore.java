package ai.kryx.tablet.security;

import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.Signature;

public final class DeviceKeyStore {
    private static final String ALIAS = "kryx_device_signing_v1";

    public String publicKeyPem() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        if (!store.containsAlias(ALIAS)) createKeyPair();

        byte[] encoded = store.getCertificate(ALIAS).getPublicKey().getEncoded();
        String body = Base64.encodeToString(encoded, Base64.NO_WRAP);
        return "-----BEGIN PUBLIC KEY-----\n" + wrap(body) + "\n-----END PUBLIC KEY-----";
    }

    public String signBase64Url(byte[] payload) throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        if (!store.containsAlias(ALIAS)) createKeyPair();

        PrivateKey privateKey = (PrivateKey) store.getKey(ALIAS, null);
        Signature signature = Signature.getInstance("SHA256withRSA");
        signature.initSign(privateKey);
        signature.update(payload);
        return Base64.encodeToString(
            signature.sign(),
            Base64.URL_SAFE | Base64.NO_WRAP | Base64.NO_PADDING
        );
    }

    private void createKeyPair() throws Exception {
        KeyPairGenerator generator = KeyPairGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_RSA,
            "AndroidKeyStore"
        );
        generator.initialize(
            new KeyGenParameterSpec.Builder(
                ALIAS,
                KeyProperties.PURPOSE_SIGN | KeyProperties.PURPOSE_VERIFY
            )
                .setDigests(
                    KeyProperties.DIGEST_SHA256,
                    KeyProperties.DIGEST_SHA512
                )
                .setSignaturePaddings(KeyProperties.SIGNATURE_PADDING_RSA_PKCS1)
                .setKeySize(2048)
                .build()
        );
        KeyPair ignored = generator.generateKeyPair();
    }

    private static String wrap(String value) {
        StringBuilder builder = new StringBuilder();
        for (int i = 0; i < value.length(); i += 64) {
            if (builder.length() > 0) builder.append('\n');
            builder.append(value, i, Math.min(i + 64, value.length()));
        }
        return builder.toString();
    }
}
