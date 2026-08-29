package com.db.dbworld.security.repository;

import com.db.dbworld.security.entity.RefreshTokenEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface RefreshTokenRepository extends JpaRepository<RefreshTokenEntity, UUID> {

    /**
     * Looks the token up regardless of whether it is spent, revoked or expired. Rotation
     * needs the spent rows too — silently returning empty for a replayed token would hide
     * exactly the breach signal we are trying to catch.
     */
    @Query("SELECT t FROM RefreshTokenEntity t JOIN FETCH t.user WHERE t.id = :id")
    Optional<RefreshTokenEntity> findByIdWithUser(@Param("id") UUID id);

    /** All sessions ever issued to a user, newest first — powers the session list. */
    List<RefreshTokenEntity> findByUser_UserIdOrderByCreatedDesc(long userId);

    /** Every token in a rotation family. Revoking a compromised session revokes the family. */
    List<RefreshTokenEntity> findByFamilyId(UUID familyId);

    /**
     * Kills every live session for a user in one statement. Used by logout-everywhere,
     * role downgrade, disable/lock, password change and deletion — all of which must not
     * leave a usable refresh token behind.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
           UPDATE RefreshTokenEntity t
              SET t.revokedAt = :now, t.revokedReason = :reason
            WHERE t.user.userId = :userId
              AND t.revokedAt IS NULL
           """)
    int revokeAllForUser(@Param("userId") long userId,
                         @Param("reason") RefreshTokenEntity.RevokeReason reason,
                         @Param("now") Instant now);

    /** Same as {@link #revokeAllForUser} but spares one family — "log out my other devices". */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
           UPDATE RefreshTokenEntity t
              SET t.revokedAt = :now, t.revokedReason = :reason
            WHERE t.user.userId = :userId
              AND t.familyId <> :keepFamilyId
              AND t.revokedAt IS NULL
           """)
    int revokeAllForUserExceptFamily(@Param("userId") long userId,
                                     @Param("keepFamilyId") UUID keepFamilyId,
                                     @Param("reason") RefreshTokenEntity.RevokeReason reason,
                                     @Param("now") Instant now);

    /** Revokes one session by family id — "sign out this device". */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
           UPDATE RefreshTokenEntity t
              SET t.revokedAt = :now, t.revokedReason = :reason
            WHERE t.familyId = :familyId
              AND t.revokedAt IS NULL
           """)
    int revokeFamily(@Param("familyId") UUID familyId,
                     @Param("reason") RefreshTokenEntity.RevokeReason reason,
                     @Param("now") Instant now);

    /** Hard-removes a user's token rows. Only the account purge should need this. */
    long deleteByUser_UserId(long userId);

    /**
     * Housekeeping: drop rows that are long past expiry so the session table does not grow
     * without bound. Kept separate from revocation, which deliberately preserves history.
     */
    @Modifying
    @Query("DELETE FROM RefreshTokenEntity t WHERE t.expiry < :cutoff")
    int deleteExpiredBefore(@Param("cutoff") Instant cutoff);
}
