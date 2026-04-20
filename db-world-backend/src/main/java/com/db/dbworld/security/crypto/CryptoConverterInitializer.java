package com.db.dbworld.security.crypto;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class CryptoConverterInitializer {

    private final CryptoProvider cryptoProvider;

    @PostConstruct
    public void init() {
        StringCryptoConverter.setCryptoProvider(cryptoProvider);
    }
}