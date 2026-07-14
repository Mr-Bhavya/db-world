package com.db.dbworld.security.repository;

import com.db.dbworld.security.entity.BiometricDeviceEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface BiometricDeviceRepository extends JpaRepository<BiometricDeviceEntity, UUID> {

    /** Exchange lookup — indexed by the unique tokenHash column. */
    Optional<BiometricDeviceEntity> findByTokenHashAndRevokedFalse(String tokenHash);

    /** Upsert / revoke lookup for a specific user + device. */
    Optional<BiometricDeviceEntity> findByUser_UserIdAndDeviceId(Long userId, String deviceId);

    /** Device-management list for a user. */
    List<BiometricDeviceEntity> findByUser_UserIdAndRevokedFalseOrderByCreatedDesc(Long userId);
}
