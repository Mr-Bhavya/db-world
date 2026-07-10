package com.db.dbworld.app.wallet.crypto;

import com.db.dbworld.core.exception.DbWorldException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class WalletFileCryptorTest {

    WalletFileCryptor cryptor;

    @BeforeEach
    void setUp() {
        byte[] key = new byte[32];
        for (int i = 0; i < 32; i++) key[i] = (byte) i;
        String b64 = Base64.getEncoder().encodeToString(key);
        cryptor = new WalletFileCryptor(b64, ""); // explicit key, no jasypt fallback
    }

    @Test
    void roundTrip_recoversOriginal() {
        byte[] plain = "Aadhaar 1234 5678 9012".getBytes(StandardCharsets.UTF_8);
        byte[] stored = cryptor.encryptBytes(plain);
        assertThat(stored.length).isGreaterThan(plain.length); // IV + tag overhead
        assertThat(cryptor.decryptBytes(stored)).isEqualTo(plain);
    }

    @Test
    void distinctIv_producesDifferentCiphertext() {
        byte[] plain = "same input".getBytes(StandardCharsets.UTF_8);
        assertThat(cryptor.encryptBytes(plain)).isNotEqualTo(cryptor.encryptBytes(plain));
    }

    @Test
    void tamperedCiphertext_isRejected() {
        byte[] stored = cryptor.encryptBytes("secret".getBytes(StandardCharsets.UTF_8));
        stored[stored.length - 1] ^= 0x01; // flip a bit in the tag
        assertThatThrownBy(() -> cryptor.decryptBytes(stored))
                .isInstanceOf(DbWorldException.class);
    }
}
