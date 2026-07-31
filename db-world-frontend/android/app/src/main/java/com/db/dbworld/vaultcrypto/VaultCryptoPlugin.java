package com.db.dbworld.vaultcrypto;

import android.app.KeyguardManager;
import android.os.Build;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyPermanentlyInvalidatedException;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.security.KeyPairGenerator;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.util.concurrent.Executor;

import javax.crypto.Cipher;

/**
 * Hardware-backed key wrapping for the offline vault cache.
 *
 * Design (envelope encryption): the vault JSON is AES-GCM encrypted in JS
 * (WebCrypto) with a random data key; that data key is RSA-OAEP *wrapped* here
 * with an Android Keystore keypair. The private key requires user authentication
 * (biometric OR device credential — PIN/pattern/password), so only a genuine
 * unlock can decrypt the cache. Wrapping uses the public key and needs no auth,
 * so refreshing the cache while online never shows a prompt.
 *
 * Both RSA operations stay native (wrap + unwrap on the same AndroidKeyStore
 * key) and both AES operations stay in JS — so there is no cross-implementation
 * OAEP/MGF1 mismatch to worry about; each side is self-consistent.
 *
 * The key uses a short auth-validity window (time-bound), which:
 *   - lets biometric AND the device screen-lock both authorise decryption, and
 *   - is permanently invalidated by the OS if the secure lock screen is removed
 *     or reset (the "phone was factory-/credential-reset" case) — surfaced to JS
 *     as code KEY_INVALIDATED so it can wipe the cache and force an online sync.
 *
 * NOTE on reject(): Capacitor's signature is reject(message, code) — human
 * message first, machine code second. The JS side keys off err.code.
 */
@CapacitorPlugin(name = "VaultCrypto")
public class VaultCryptoPlugin extends Plugin {

    private static final String ANDROID_KEYSTORE = "AndroidKeyStore";
    private static final String ALIAS = "com.db.dbworld.vault.v1";
    private static final String TRANSFORM = "RSA/ECB/OAEPWithSHA-256AndMGF1Padding";
    private static final int AUTH_VALIDITY_SECONDS = 30;

    private static final int ALLOWED_AUTHENTICATORS =
            BiometricManager.Authenticators.BIOMETRIC_STRONG
                    | BiometricManager.Authenticators.DEVICE_CREDENTIAL;

    // ── Public API ────────────────────────────────────────────────────────────

    /** Ensure the keypair exists. Rejects NO_LOCK when the device has no secure lock screen. */
    @PluginMethod
    public void prepare(PluginCall call) {
        try {
            ensureKey();
            JSObject r = new JSObject();
            r.put("ready", true);
            call.resolve(r);
        } catch (NoLockException e) {
            call.reject("Device has no secure lock screen", "NO_LOCK");
        } catch (Exception e) {
            call.reject(String.valueOf(e.getMessage()), "PREPARE_FAILED");
        }
    }

    /** Report whether we can protect/unlock a cache on this device. Never rejects. */
    @PluginMethod
    public void isSecure(PluginCall call) {
        JSObject r = new JSObject();
        try {
            KeyguardManager km = getContext().getSystemService(KeyguardManager.class);
            boolean deviceSecure = km != null && km.isDeviceSecure();
            int can = BiometricManager.from(getContext()).canAuthenticate(ALLOWED_AUTHENTICATORS);
            r.put("secure", deviceSecure);
            r.put("canAuthenticate", can == BiometricManager.BIOMETRIC_SUCCESS);
            r.put("biometric",
                    BiometricManager.from(getContext())
                            .canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG)
                            == BiometricManager.BIOMETRIC_SUCCESS);
        } catch (Exception e) {
            r.put("secure", false);
            r.put("canAuthenticate", false);
            r.put("biometric", false);
        }
        call.resolve(r);
    }

    /** RSA-OAEP wrap a base64 AES data key with the public key. No user auth required. */
    @PluginMethod
    public void wrapKey(PluginCall call) {
        final String keyB64 = call.getString("key");
        if (keyB64 == null || keyB64.isEmpty()) { call.reject("key required", "BAD_ARGS"); return; }
        try {
            ensureKey();
            PublicKey pub = loadKeyStore().getCertificate(ALIAS).getPublicKey();
            Cipher cipher = Cipher.getInstance(TRANSFORM);
            cipher.init(Cipher.ENCRYPT_MODE, pub);
            byte[] wrapped = cipher.doFinal(Base64.decode(keyB64, Base64.NO_WRAP));
            JSObject r = new JSObject();
            r.put("wrapped", Base64.encodeToString(wrapped, Base64.NO_WRAP));
            call.resolve(r);
        } catch (NoLockException e) {
            call.reject("Device has no secure lock screen", "NO_LOCK");
        } catch (Exception e) {
            call.reject(String.valueOf(e.getMessage()), "WRAP_FAILED");
        }
    }

    /**
     * Prompt for biometric / device-credential, then RSA-OAEP unwrap the data key.
     * Resolves { key: <base64 AES key> }. Rejects CANCELED, KEY_INVALIDATED, or
     * NO_KEY / DECRYPT_FAILED.
     */
    @PluginMethod
    public void unwrapKey(PluginCall call) {
        final String wrappedB64 = call.getString("wrapped");
        if (wrappedB64 == null || wrappedB64.isEmpty()) { call.reject("wrapped required", "BAD_ARGS"); return; }
        final String title = call.getString("title", "Unlock your vault");
        final String subtitle = call.getString("subtitle", "Verify it's you to view your saved passwords offline");

        final FragmentActivity activity = (FragmentActivity) getActivity();
        if (activity == null) { call.reject("No foreground activity", "NO_ACTIVITY"); return; }

        activity.runOnUiThread(() -> {
            try {
                KeyStore ks = loadKeyStore();
                if (!ks.containsAlias(ALIAS)) { call.reject("No cached key", "NO_KEY"); return; }

                Executor exec = ContextCompat.getMainExecutor(getContext());
                BiometricPrompt prompt = new BiometricPrompt(activity, exec, new BiometricPrompt.AuthenticationCallback() {
                    @Override
                    public void onAuthenticationError(int errorCode, CharSequence errString) {
                        if (errorCode == BiometricPrompt.ERROR_USER_CANCELED
                                || errorCode == BiometricPrompt.ERROR_NEGATIVE_BUTTON
                                || errorCode == BiometricPrompt.ERROR_CANCELED) {
                            call.reject("Authentication canceled", "CANCELED");
                        } else {
                            call.reject(String.valueOf(errString), "AUTH_ERROR");
                        }
                    }

                    @Override
                    public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                        try {
                            // Time-bound key: the auth we just passed authorises this decrypt.
                            PrivateKey pk = (PrivateKey) loadKeyStore().getKey(ALIAS, null);
                            Cipher cipher = Cipher.getInstance(TRANSFORM);
                            cipher.init(Cipher.DECRYPT_MODE, pk);
                            byte[] raw = cipher.doFinal(Base64.decode(wrappedB64, Base64.NO_WRAP));
                            JSObject r = new JSObject();
                            r.put("key", Base64.encodeToString(raw, Base64.NO_WRAP));
                            call.resolve(r);
                        } catch (KeyPermanentlyInvalidatedException e) {
                            deleteKey();
                            call.reject("Device security changed", "KEY_INVALIDATED");
                        } catch (Exception e) {
                            call.reject(String.valueOf(e.getMessage()), "DECRYPT_FAILED");
                        }
                    }
                });

                BiometricPrompt.PromptInfo info = new BiometricPrompt.PromptInfo.Builder()
                        .setTitle(title)
                        .setSubtitle(subtitle)
                        .setAllowedAuthenticators(ALLOWED_AUTHENTICATORS)
                        .build();
                prompt.authenticate(info);
            } catch (Exception e) {
                call.reject(String.valueOf(e.getMessage()), "AUTH_ERROR");
            }
        });
    }

    /** Delete the keypair (on logout, or after a KEY_INVALIDATED). Never rejects. */
    @PluginMethod
    public void reset(PluginCall call) {
        deleteKey();
        JSObject r = new JSObject();
        r.put("ok", true);
        call.resolve(r);
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    private static class NoLockException extends Exception {}

    private KeyStore loadKeyStore() throws Exception {
        KeyStore ks = KeyStore.getInstance(ANDROID_KEYSTORE);
        ks.load(null);
        return ks;
    }

    private void ensureKey() throws Exception {
        KeyStore ks = loadKeyStore();
        if (ks.containsAlias(ALIAS)) return;

        // Auth-required keys can only be generated when a secure lock screen exists.
        KeyguardManager km = getContext().getSystemService(KeyguardManager.class);
        if (km == null || !km.isDeviceSecure()) throw new NoLockException();

        KeyPairGenerator kpg = KeyPairGenerator.getInstance(
                KeyProperties.KEY_ALGORITHM_RSA, ANDROID_KEYSTORE);

        KeyGenParameterSpec.Builder builder = new KeyGenParameterSpec.Builder(
                ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setKeySize(2048)
                .setDigests(KeyProperties.DIGEST_SHA256, KeyProperties.DIGEST_SHA1)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_RSA_OAEP)
                .setUserAuthenticationRequired(true);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            builder.setUserAuthenticationParameters(
                    AUTH_VALIDITY_SECONDS,
                    KeyProperties.AUTH_BIOMETRIC_STRONG | KeyProperties.AUTH_DEVICE_CREDENTIAL);
        } else {
            //noinspection deprecation
            builder.setUserAuthenticationValidityDurationSeconds(AUTH_VALIDITY_SECONDS);
        }
        // New fingerprint enrolment also invalidates the key (best-effort; primary
        // protection is invalidation-on-lock-screen-reset from setUserAuthenticationRequired).
        try { builder.setInvalidatedByBiometricEnrollment(true); } catch (Exception ignored) {}

        kpg.initialize(builder.build());
        kpg.generateKeyPair();
    }

    private void deleteKey() {
        try {
            KeyStore ks = loadKeyStore();
            if (ks.containsAlias(ALIAS)) ks.deleteEntry(ALIAS);
        } catch (Exception ignored) {}
    }
}
