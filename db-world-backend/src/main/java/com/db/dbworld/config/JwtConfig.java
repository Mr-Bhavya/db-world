package com.db.dbworld.config;

import com.db.dbworld.services.auth.JwtService;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.source.ImmutableJWKSet;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;

import java.io.InputStream;
import java.security.KeyFactory;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.*;
import java.time.Duration;
import java.util.Base64;

@Configuration
public class JwtConfig {

    private static final String RSA = "RSA";

    private final RSAPublicKey publicKey;
    private final RSAPrivateKey privateKey;
    private final Duration accessTokenTtl = Duration.ofDays(1);

    public JwtConfig(@Value("${jwt.key.public:}") String publicKeyStr,
                     @Value("${jwt.key.private:}") String privateKeyStr) throws Exception {
        if (!publicKeyStr.isBlank() && !privateKeyStr.isBlank()) {
            this.publicKey = loadKeyFromString(publicKeyStr, RSAPublicKey.class);
            this.privateKey = loadKeyFromString(privateKeyStr, RSAPrivateKey.class);
        } else {
            this.publicKey = loadKeyFromResource("keys/rsa-public.key", RSAPublicKey.class);
            this.privateKey = loadKeyFromResource("keys/rsa-private.key", RSAPrivateKey.class);
        }
    }

    @Bean
    public JwtEncoder jwtEncoder() {
        RSAKey jwk = new RSAKey.Builder(publicKey)
                .privateKey(privateKey)
                .build();
        return new NimbusJwtEncoder(new ImmutableJWKSet<>(new JWKSet(jwk)));
    }

    @Bean
    public JwtDecoder jwtDecoder() {
        return NimbusJwtDecoder.withPublicKey(publicKey).build();
    }

    @Bean
    public JwtService jwtService(@Value("${spring.application.name}") String appName,
                                 JwtEncoder jwtEncoder) {
        return new JwtService(appName, accessTokenTtl, jwtEncoder);
    }

    private <T> T loadKeyFromResource(String path, Class<T> keyType) throws Exception {
        String keyContent = readKey(new ClassPathResource(path));
        return loadKey(keyContent, keyType);
    }

    private <T> T loadKeyFromString(String pem, Class<T> keyType) throws Exception {
        String keyContent = stripPemHeaders(pem);
        return loadKey(keyContent, keyType);
    }

    private <T> T loadKey(String base64Key, Class<T> keyType) throws Exception {
        byte[] decoded = Base64.getDecoder().decode(base64Key);
        KeyFactory keyFactory = KeyFactory.getInstance(RSA);

        if (RSAPublicKey.class.equals(keyType)) {
            return keyType.cast(keyFactory.generatePublic(new X509EncodedKeySpec(decoded)));
        } else if (RSAPrivateKey.class.equals(keyType)) {
            return keyType.cast(keyFactory.generatePrivate(new PKCS8EncodedKeySpec(decoded)));
        }
        throw new IllegalArgumentException("Unsupported key type: " + keyType);
    }

    private String readKey(ClassPathResource resource) throws Exception {
        try (InputStream is = resource.getInputStream()) {
            return stripPemHeaders(new String(is.readAllBytes()));
        }
    }

    private String stripPemHeaders(String pem) {
        return pem.replaceAll("-----\\w+ PRIVATE KEY-----", "")
                .replaceAll("-----\\w+ PUBLIC KEY-----", "")
                .replaceAll("\\s", "")
                .trim();
    }
}
