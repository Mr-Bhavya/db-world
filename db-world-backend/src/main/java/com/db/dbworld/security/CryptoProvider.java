package com.db.dbworld.security;

import org.jasypt.encryption.StringEncryptor;
import org.springframework.stereotype.Component;

@Component
public class CryptoProvider {

    private static StringEncryptor encryptor;

    public CryptoProvider(StringEncryptor encryptor) {
        CryptoProvider.encryptor = encryptor;
    }

    public static StringEncryptor get() {
        if (encryptor == null) {
            throw new IllegalStateException("Encryptor not initialized yet");
        }
        return encryptor;
    }
}