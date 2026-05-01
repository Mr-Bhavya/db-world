package com.db.dbworld.app.pm.service;

import com.db.dbworld.app.pm.entity.CredentialEntity;
import com.db.dbworld.app.pm.repository.CredentialsRepository;
import com.db.dbworld.security.crypto.CryptoProvider;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class CryptoMigrationService {

    private final CryptoProvider cryptoProvider;
    private final CredentialsRepository credentialsRepository;

    @Transactional
    public void migrateIfNeeded(CredentialEntity credential) {

        boolean updated = false;

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
        }
    }
}
