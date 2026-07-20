package com.db.dbworld.app.wallet.crypto;

import com.db.dbworld.core.exception.DbWorldException;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import javax.crypto.AEADBadTagException;
import javax.crypto.Cipher;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * AES-256-GCM encryption for wallet document blobs.
 * On-disk format: [12-byte random IV][ciphertext + 16-byte GCM auth tag].
 * Uses in-memory doFinal (documents are small, capped by wallet.max-file-size-bytes) so that
 * GCM tamper detection is reliable — CipherInputStream can silently swallow AEADBadTagException.
 */
@Log4j2
@Component
public class WalletFileCryptor {

    private static final String TRANSFORM = "AES/GCM/NoPadding";
    private static final int    IV_BYTES  = 12;
    private static final int    TAG_BITS  = 128;
    private static final byte[] PBKDF2_SALT  = "db-world-wallet-v1".getBytes(StandardCharsets.UTF_8);

    private final SecretKeySpec key;
    private final SecureRandom  random = new SecureRandom();

    public WalletFileCryptor(
            @Value("${wallet.encryption-key:${WALLET_ENCRYPTION_KEY:}}") String base64Key,
            @Value("${jasypt.encryptor.password:${JASYPT_PASSWORD:}}") String jasyptPassword) {
        this.key = resolveKey(base64Key, jasyptPassword);
    }

    private SecretKeySpec resolveKey(String base64Key, String jasyptPassword) {
        if (base64Key != null && !base64Key.isBlank()) {
            byte[] raw;
            try {
                raw = Base64.getDecoder().decode(base64Key.trim());
            } catch (IllegalArgumentException e) {
                throw new DbWorldException(HttpStatus.INTERNAL_SERVER_ERROR,
                        "WALLET_ENCRYPTION_KEY is not valid base64", e);
            }
            if (raw.length != 32) {
                throw new DbWorldException(HttpStatus.INTERNAL_SERVER_ERROR,
                        "WALLET_ENCRYPTION_KEY must decode to 32 bytes, got " + raw.length);
            }
            return new SecretKeySpec(raw, "AES");
        }
        if (jasyptPassword == null || jasyptPassword.isBlank()) {
            throw new DbWorldException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "No wallet encryption key: set WALLET_ENCRYPTION_KEY (base64 32 bytes).");
        }
        log.warn("WALLET_ENCRYPTION_KEY not set; deriving wallet key from JASYPT_PASSWORD via PBKDF2. "
                + "Set a dedicated WALLET_ENCRYPTION_KEY in production.");
        try {
            SecretKeyFactory f = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256");
            byte[] raw = f.generateSecret(new PBEKeySpec(jasyptPassword.toCharArray(), PBKDF2_SALT, 65_536, 256))
                          .getEncoded();
            return new SecretKeySpec(raw, "AES");
        } catch (Exception e) {
            throw new DbWorldException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to derive wallet key", e);
        }
    }

    public byte[] encryptBytes(byte[] plain) {
        try {
            byte[] iv = new byte[IV_BYTES];
            random.nextBytes(iv);
            Cipher cipher = Cipher.getInstance(TRANSFORM);
            cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, iv));
            byte[] ct = cipher.doFinal(plain);
            byte[] out = new byte[IV_BYTES + ct.length];
            System.arraycopy(iv, 0, out, 0, IV_BYTES);
            System.arraycopy(ct, 0, out, IV_BYTES, ct.length);
            return out;
        } catch (Exception e) {
            throw new DbWorldException(HttpStatus.INTERNAL_SERVER_ERROR, "Wallet encryption failed", e);
        }
    }

    public byte[] decryptBytes(byte[] stored) {
        if (stored == null || stored.length <= IV_BYTES) {
            throw new DbWorldException(HttpStatus.BAD_REQUEST, "Corrupt wallet file");
        }
        try {
            Cipher cipher = Cipher.getInstance(TRANSFORM);
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, stored, 0, IV_BYTES));
            return cipher.doFinal(stored, IV_BYTES, stored.length - IV_BYTES);
        } catch (AEADBadTagException e) {
            throw new DbWorldException(HttpStatus.BAD_REQUEST, "Wallet file failed integrity check", e);
        } catch (Exception e) {
            throw new DbWorldException(HttpStatus.INTERNAL_SERVER_ERROR, "Wallet decryption failed", e);
        }
    }
}
