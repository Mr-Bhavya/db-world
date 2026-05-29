package com.db.dbworld.security;

import com.db.dbworld.config.JwtProperties;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.springframework.stereotype.Component;

import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyFactory;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.*;
import java.util.Base64;
import java.util.Objects;

@Component
public class RsaKeyProvider {

    private static final Logger log = LogManager.getLogger();

    private static final String RSA = "RSA";

    private final JwtProperties props;

    private volatile RSAPublicKey publicKey;
    private volatile RSAPrivateKey privateKey;

    public RsaKeyProvider(JwtProperties props) {
        this.props = props;
    }

    public RSAPublicKey getPublicKey() {
        if (publicKey == null) {
            synchronized (this) {
                if (publicKey == null) publicKey = loadPublicKey();
            }
        }
        return publicKey;
    }

    public RSAPrivateKey getPrivateKey() {
        if (privateKey == null) {
            synchronized (this) {
                if (privateKey == null) privateKey = loadPrivateKey();
            }
        }
        return privateKey;
    }

    private RSAPublicKey loadPublicKey() {
        try {
            String pem = resolveKey(props.publicKey(), props.publicKeyPath());
            byte[] decoded = Base64.getDecoder().decode(strip(pem));
            RSAPublicKey key = (RSAPublicKey) KeyFactory.getInstance(RSA)
                    .generatePublic(new X509EncodedKeySpec(decoded));
            log.info("RSA public key loaded (modulus bits={})", key.getModulus().bitLength());
            return key;
        } catch (Exception e) {
            log.error("Failed to load RSA public key: {}", e.getMessage(), e);
            throw new IllegalStateException("Failed to load RSA public key", e);
        }
    }

    private RSAPrivateKey loadPrivateKey() {
        try {
            String pem = resolveKey(props.privateKey(), props.privateKeyPath());
            byte[] decoded = Base64.getDecoder().decode(strip(pem));
            RSAPrivateKey key = (RSAPrivateKey) KeyFactory.getInstance(RSA)
                    .generatePrivate(new PKCS8EncodedKeySpec(decoded));
            log.info("RSA private key loaded (modulus bits={})", key.getModulus().bitLength());
            return key;
        } catch (Exception e) {
            log.error("Failed to load RSA private key: {}", e.getMessage(), e);
            throw new IllegalStateException("Failed to load RSA private key", e);
        }
    }

    private String resolveKey(String value, String path) throws Exception {
        if (value != null && !value.isBlank()) return value;
        return Files.readString(Path.of(Objects.requireNonNull(path, "Key path missing")));
    }

    private String strip(String pem) {
        return pem.replaceAll("-----BEGIN (.*)-----", "")
                .replaceAll("-----END (.*)-----", "")
                .replaceAll("\\s+", "");
    }
}
