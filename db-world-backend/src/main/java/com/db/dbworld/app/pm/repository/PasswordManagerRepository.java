package com.db.dbworld.app.pm.repository;

import com.db.dbworld.app.pm.entity.PasswordManagerEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface PasswordManagerRepository extends JpaRepository<PasswordManagerEntity, String> {
    List<PasswordManagerEntity> findAllByHostNameAndUserEntityUserId(String host, Long userId);
    List<PasswordManagerEntity> findAllByUserEntityUserId(Long userId);
    Optional<PasswordManagerEntity> findByIdAndUserEntityUserIdAndCredentialsId(String pmId, Long UserId, String credentialId);
    Optional<PasswordManagerEntity> findByIdAndUserEntityUserId(String pmId, Long userId);

    /**
     * Count only, for the home hub's Vault tile — never the credentials themselves. Counts the
     * groups that hold at least one live entry: a group with only trashed entries is not in the vault.
     */
    @Query("select count(distinct p) from PasswordManagerEntity p join p.credentials c "
            + "where p.userEntity.userId = :userId and c.deletedAt is null")
    long countByUserEntityUserId(@Param("userId") Long userId);
}
