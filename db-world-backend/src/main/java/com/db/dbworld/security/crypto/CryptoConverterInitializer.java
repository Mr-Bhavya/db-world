package com.db.dbworld.security.crypto;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Component;

@Log4j2
@Component
@RequiredArgsConstructor
public class CryptoConverterInitializer {

    private final CryptoProvider cryptoProvider;

    @PostConstruct
    public void init() {
        StringCryptoConverter.setCryptoProvider(cryptoProvider);
        log.info("StringCryptoConverter wired with CryptoProvider");
    }
}