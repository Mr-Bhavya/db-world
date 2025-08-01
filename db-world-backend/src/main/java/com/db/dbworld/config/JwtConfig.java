package com.db.dbworld.config;


import com.db.dbworld.services.auth.JwtService;
import com.nimbusds.jose.jwk.*;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.source.ImmutableJWKSet;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;
import org.springframework.security.oauth2.jwt.*;
import java.io.InputStream;
import java.security.KeyFactory;
import java.security.interfaces.*;
import java.security.spec.*;
import java.time.Duration;
import java.util.Base64;

@Configuration
@ConfigurationProperties(prefix = "jwt.token")
public class JwtConfig {

    private final RSAPublicKey publicKey;
    private final RSAPrivateKey privateKey;
    private final Duration accessTokenTtl = Duration.ofDays(1);

    public JwtConfig() throws Exception {
        this.publicKey = loadPublicKey("keys/rsa-public.key");
        this.privateKey = loadPrivateKey("keys/rsa-private.key");
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
    public JwtService jwtService(@Value("${spring.application.name}") final String appName, final JwtEncoder jwtEncoder) {
        return new JwtService(appName, accessTokenTtl, jwtEncoder);
    }

    private RSAPublicKey loadPublicKey(String path) throws Exception {
        String key = readKey(path);
        byte[] decoded = Base64.getDecoder().decode(key);
        X509EncodedKeySpec keySpec = new X509EncodedKeySpec(decoded);
        return (RSAPublicKey) KeyFactory.getInstance("RSA").generatePublic(keySpec);
    }

    private RSAPrivateKey loadPrivateKey(String path) throws Exception {
        String key = readKey(path);
        byte[] decoded = Base64.getDecoder().decode(key);
        PKCS8EncodedKeySpec keySpec = new PKCS8EncodedKeySpec(decoded);
        return (RSAPrivateKey) KeyFactory.getInstance("RSA").generatePrivate(keySpec);
    }

    private String readKey(String resourcePath) throws Exception {
        ClassPathResource resource = new ClassPathResource(resourcePath);
        try (InputStream is = resource.getInputStream()) {
            return new String(is.readAllBytes())
                    .replaceAll("\\r", "")
                    .replaceAll("\\n", "")
                    .replace("-----BEGIN PUBLIC KEY-----", "")
                    .replace("-----END PUBLIC KEY-----", "")
                    .replace("-----BEGIN PRIVATE KEY-----", "")
                    .replace("-----END PRIVATE KEY-----", "")
                    .trim();
        }
    }
}
