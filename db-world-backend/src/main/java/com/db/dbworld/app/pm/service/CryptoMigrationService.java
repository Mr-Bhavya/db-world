package com.db.dbworld.app.pm.service;

import com.db.dbworld.app.pm.entity.CredentialEntity;
import com.db.dbworld.app.pm.repository.CredentialsRepository;
import com.db.dbworld.security.crypto.CryptoProvider;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Component;

@Log4j2
@Component
@RequiredArgsConstructor
public class CryptoMigrationService {

    private final CryptoProvider cryptoProvider;
    private final CredentialsRepository credentialsRepository;

    @Transactional
    public void migrateIfNeeded(CredentialEntity credential) {
        log.debug("migrateIfNeeded credentialId={}", credential.getId());

        boolean updated = false;

        try {
            if (cryptoProvider.isLegacy(credential.getPassword())) {
                credential.setPassword(
                        cryptoProvider.migrate(credential.getPassword())
                );
                updated = true;
            }

            if (credential.getNotes() != null &&
                    cryptoProvider.isLegacy(credential.getNotes())) {

                credential.setNotes(
                        cryptoProvider.migrate(credential.getNotes())
                );
                updated = true;
            }

            if (credential.getUsername() != null &&
                    cryptoProvider.isLegacy(credential.getUsername())) {

                credential.setUsername(
                        cryptoProvider.migrate(credential.getUsername())
                );
                updated = true;
            }

            if (updated) {
                credentialsRepository.save(credential);
                log.info("Migrated legacy ciphertext for credentialId={}", credential.getId());
            }
        } catch (Exception e) {
            log.error("Crypto migration failed for credentialId={}", credential.getId(), e);
            throw e;
        }
    }
}
