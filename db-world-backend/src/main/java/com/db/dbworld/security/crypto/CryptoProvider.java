package com.db.dbworld.security.crypto;

import com.db.dbworld.config.JasyptProperties;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.jasypt.encryption.pbe.PooledPBEStringEncryptor;
import org.jasypt.encryption.pbe.config.SimpleStringPBEConfig;
import org.springframework.stereotype.Component;

@Component
public class CryptoProvider {

    private static final Logger log = LogManager.getLogger();

    private static final String AES_PREFIX = "AES:";

    private final PooledPBEStringEncryptor desEncryptor;
    private final PooledPBEStringEncryptor aesEncryptor;

    public CryptoProvider(JasyptProperties props) {

        String password = props.password();

        if (password == null || password.isBlank()) {
            log.error("CryptoProvider init failed: Jasypt password is missing or empty");
            throw new IllegalStateException("Jasypt password is missing or empty");
        }

        // ───────────── DES (LEGACY SUPPORT) ─────────────
        desEncryptor = new PooledPBEStringEncryptor();
        SimpleStringPBEConfig desConfig = new SimpleStringPBEConfig();
        desConfig.setPassword(password);
        desConfig.setAlgorithm("PBEWithMD5AndDES");
        desConfig.setKeyObtentionIterations("1000");
        desConfig.setPoolSize("1");
        desConfig.setSaltGeneratorClassName("org.jasypt.salt.RandomSaltGenerator");
        desConfig.setStringOutputType("base64");
        desEncryptor.setConfig(desConfig);

        // ───────────── AES (MODERN ENCRYPTION) ─────────────
        aesEncryptor = new PooledPBEStringEncryptor();
        SimpleStringPBEConfig aesConfig = new SimpleStringPBEConfig();
        aesConfig.setPassword(password);
        aesConfig.setAlgorithm("PBEWITHHMACSHA512ANDAES_256");
        aesConfig.setKeyObtentionIterations("1000");
        aesConfig.setPoolSize("1");
        aesConfig.setSaltGeneratorClassName("org.jasypt.salt.RandomSaltGenerator");
        aesConfig.setIvGeneratorClassName("org.jasypt.iv.RandomIvGenerator");
        aesConfig.setStringOutputType("base64");
        aesEncryptor.setConfig(aesConfig);

        log.info("CryptoProvider initialized (AES + DES-legacy fallback)");
    }

    // ─────────────────────────────────────────────
    // ENCRYPT (always AES)
    // ─────────────────────────────────────────────
    public String encrypt(String value) {
        if (value == null) return null;
        return AES_PREFIX + aesEncryptor.encrypt(value);
    }

    // ─────────────────────────────────────────────
    // SAFE DECRYPT (handles ALL cases)
    // ─────────────────────────────────────────────
    public String decrypt(String value) {
        if (value == null) return null;

        // AES (new format)
        if (value.startsWith(AES_PREFIX)) {
            return aesDecrypt(value.substring(AES_PREFIX.length()));
        }

        // Try DES (legacy)
        String des = tryDesDecrypt(value);
        if (des != null) return des;

        // Fallback: assume plain text (important for migration safety)
        return value;
    }

    // ─────────────────────────────────────────────
    // LEGACY CHECK
    // ─────────────────────────────────────────────
    public boolean isLegacy(String value) {
        return value != null && !value.startsWith(AES_PREFIX);
    }

    // ─────────────────────────────────────────────
    // MIGRATE (DES / PLAIN → AES)
    // ─────────────────────────────────────────────
    public String migrate(String value) {
        if (value == null) return null;

        // Already AES → skip
        if (value.startsWith(AES_PREFIX)) {
            return value;
        }

        String plain = decrypt(value);

        // Always re-encrypt to AES
        return encrypt(plain);
    }

    // ─────────────────────────────────────────────
    // INTERNAL HELPERS
    // ─────────────────────────────────────────────

    private String aesDecrypt(String value) {
        try {
            return aesEncryptor.decrypt(value);
        } catch (Exception ex) {
            log.error("AES decryption failed: {}", ex.getMessage(), ex);
            throw new RuntimeException("AES decryption failed. Possibly wrong key/config.", ex);
        }
    }

    private String tryDesDecrypt(String value) {
        try {
            return desEncryptor.decrypt(value);
        } catch (Exception ignored) {
            // Expected during migration when value is neither DES nor AES.
            // No log — would spam at WARN for every plain-text fallback.
            return null;
        }
    }
}