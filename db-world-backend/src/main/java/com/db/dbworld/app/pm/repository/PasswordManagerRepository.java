package com.db.dbworld.dao.pm;

import com.db.dbworld.app.pm.entity.PasswordManagerEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PasswordManagerRepository extends JpaRepository<PasswordManagerEntity, String> {
    List<PasswordManagerEntity> findAllByHostNameAndUserEntityUserId(String host, Long userId);
    List<PasswordManagerEntity> findAllByUserEntityUserId(Long userId);
    Optional<PasswordManagerEntity> findByIdAndUserEntityUserIdAndCredentialsId(String pmId, Long UserId, String credentialId);
    void deleteByIdAndUserEntityUserId(String pmId, Long userId);
    void deleteByCredentialsIdAndUserEntityUserId(String credentialId, Long userId);
}
