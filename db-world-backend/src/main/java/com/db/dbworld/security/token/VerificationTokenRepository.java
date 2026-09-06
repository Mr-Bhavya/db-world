package com.db.dbworld.security.token;

import com.db.dbworld.security.token.VerificationTokenEntity.Purpose;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface VerificationTokenRepository extends JpaRepository<VerificationTokenEntity, UUID> {

    @Query("SELECT t FROM VerificationTokenEntity t JOIN FETCH t.user WHERE t.tokenHash = :hash")
    Optional<VerificationTokenEntity> findByTokenHashWithUser(@Param("hash") String hash);

    /**
     * Spends every outstanding token of a purpose for a user.
     *
     * <p>Called before issuing a new one, so requesting a second reset link invalidates the
     * first. Otherwise every request would leave another live token in the user's mailbox, and
     * an old email forwarded or left on a shared machine would still work.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
           UPDATE VerificationTokenEntity t
              SET t.usedAt = :now
            WHERE t.user.userId = :userId
              AND t.purpose = :purpose
              AND t.usedAt IS NULL
           """)
    int invalidateOutstanding(@Param("userId") long userId,
                              @Param("purpose") Purpose purpose,
                              @Param("now") Instant now);

    /** Housekeeping — drop rows long past expiry so the table does not grow without bound. */
    @Modifying
    @Query("DELETE FROM VerificationTokenEntity t WHERE t.expiry < :cutoff")
    int deleteExpiredBefore(@Param("cutoff") Instant cutoff);

    /** Removes a purged account's tokens. */
    long deleteByUser_UserId(long userId);
}
