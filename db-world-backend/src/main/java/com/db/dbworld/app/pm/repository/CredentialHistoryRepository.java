package com.db.dbworld.app.pm.repository;

import com.db.dbworld.app.pm.entity.CredentialHistoryEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface CredentialHistoryRepository extends JpaRepository<CredentialHistoryEntity, String> {

    /** The entry's earlier passwords, newest first (the id breaks a tie in time, so the order is stable). */
    List<CredentialHistoryEntity> findAllByCredentialIdOrderByChangedAtDescIdDesc(String credentialId);

    /** One history row, only if it belongs to that entry. */
    Optional<CredentialHistoryEntity> findByIdAndCredentialId(String id, String credentialId);

    /**
     * Removes every row of an entry in one statement, run at once: it must happen before the entry
     * itself is deleted, or the foreign key refuses.
     */
    @Modifying
    @Query("delete from CredentialHistoryEntity h where h.credential.id = :credentialId")
    void deleteByCredentialId(@Param("credentialId") String credentialId);
}
