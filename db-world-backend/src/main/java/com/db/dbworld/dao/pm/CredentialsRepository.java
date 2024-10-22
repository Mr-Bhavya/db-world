package com.db.dbworld.dao.pm;

import com.db.dbworld.entities.pm.CredentialEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CredentialsRepository extends JpaRepository<CredentialEntity, String> {
    void deleteByIdAndPasswordManagerUserEntityUserId(String credentialId, Long userId);
}
