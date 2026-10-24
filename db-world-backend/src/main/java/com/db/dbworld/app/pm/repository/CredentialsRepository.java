package com.db.dbworld.app.pm.repository;

import com.db.dbworld.app.pm.entity.CredentialEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface CredentialsRepository extends JpaRepository<CredentialEntity, String> {

    /** A credential of this user, live or trashed. Another user's id finds nothing. */
    Optional<CredentialEntity> findByIdAndPasswordManagerUserEntityUserId(String credentialId, Long userId);

    /** Every user's entries trashed before the cutoff: what the purge job removes. */
    List<CredentialEntity> findAllByDeletedAtBefore(Instant cutoff);
}
