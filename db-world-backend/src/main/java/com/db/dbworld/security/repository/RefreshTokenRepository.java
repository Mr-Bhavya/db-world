package com.db.dbworld.security.repository;

import com.db.dbworld.security.entity.RefreshTokenEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface RefreshTokenRepository extends JpaRepository<RefreshTokenEntity, UUID> {
    Optional<RefreshTokenEntity> findByIdAndExpiryAfter(UUID id, Instant date);

    /** All refresh tokens (sessions) issued to a user. */
    List<RefreshTokenEntity> findByUser_UserId(long userId);

    /** Revoke every session for a user (force logout everywhere). Returns the count removed. */
    long deleteByUser_UserId(long userId);
}
