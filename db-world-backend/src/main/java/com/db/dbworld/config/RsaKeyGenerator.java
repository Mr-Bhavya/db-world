package com.db.dbworld.config;

import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.nio.file.*;
import java.util.Base64;

public class RsaKeyGenerator {

    public static void main(String[] args) throws Exception {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
        generator.initialize(2048);
        KeyPair pair = generator.generateKeyPair();

        String publicKey = Base64.getEncoder().encodeToString(pair.getPublic().getEncoded());
        String privateKey = Base64.getEncoder().encodeToString(pair.getPrivate().getEncoded());

        Files.writeString(Path.of("rsa-public.key"), publicKey);
        Files.writeString(Path.of("rsa-private.key"), privateKey);

        System.out.println("✅ Keys generated successfully.");
    }
}
