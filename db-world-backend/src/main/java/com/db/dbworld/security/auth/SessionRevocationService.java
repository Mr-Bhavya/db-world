package com.db.dbworld.security.auth;

import com.db.dbworld.core.push.PushDeviceTokenRepository;
import com.db.dbworld.security.entity.RefreshTokenEntity.RevokeReason;
import com.db.dbworld.security.repository.BiometricDeviceRepository;
import com.db.dbworld.security.repository.RefreshTokenRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

/**
 * The single place that ends sessions.
 *
 * <p>Extracted from {@code AuthenticationService} so that user administration can revoke
 * sessions without the two services depending on each other — {@code AuthenticationService}
 * already needs {@code UserService}, so having {@code UserService} reach back for revocation
 * would close a circular dependency.
 *
 * <p>Every method here does two things, and both matter: it revokes the refresh tokens (so no
 * new access token can be minted) and it bumps the token version (so the access tokens already
 * issued die now rather than in up to five minutes). Revoking without bumping is the subtle
 * bug this class exists to prevent.
 */
@Log4j2
@Service
@RequiredArgsConstructor
public class SessionRevocationService {

    private final RefreshTokenRepository refreshTokenRepository;
    private final BiometricDeviceRepository biometricDeviceRepository;
    private final PushDeviceTokenRepository pushDeviceTokenRepository;
    private final TokenVersionService tokenVersionService;

    /**
     * Ends every session for a user.
     *
     * @param keepFamilyId session to spare, for signing out the OTHER devices only. Null ends all.
     * @return number of session rows revoked
     */
    @Transactional
    public int revokeAll(final long userId, final RevokeReason reason, final UUID keepFamilyId) {
        final Instant now = Instant.now();
        final int revoked = keepFamilyId == null
                ? refreshTokenRepository.revokeAllForUser(userId, reason, now)
                : refreshTokenRepository.revokeAllForUserExceptFamily(userId, keepFamilyId, reason, now);

        tokenVersionService.bump(userId, "revokeAll: " + reason);

        log.info("Revoked {} sessions for userId={} (reason={}, kept family={})",
                revoked, userId, reason, keepFamilyId);
        return revoked;
    }

    /** Ends one session by family id, but only if it belongs to this user. */
    @Transactional
    public boolean revokeFamily(final long userId, final UUID familyId, final RevokeReason reason) {
        final boolean ownsFamily = refreshTokenRepository.findByFamilyId(familyId).stream()
                .anyMatch(t -> t.getUser().getUserId() == userId);
        if (!ownsFamily) {
            log.warn("Refused to revoke family={} — does not belong to userId={}", familyId, userId);
            return false;
        }
        final int revoked = refreshTokenRepository.revokeFamily(familyId, reason, Instant.now());
        log.info("Revoked session family={} for userId={} (reason={})", familyId, userId, reason);
        return revoked > 0;
    }

    /**
     * Ends every way into the account: sessions, biometric enrollments and push registrations.
     *
     * <p>Used on password change, admin reset and deletion. Biometric device tokens are the
     * reason this is not just {@link #revokeAll} — an enrolled device can mint a brand new
     * session without any password, so rotating the password while leaving enrollments intact
     * would not actually lock anyone out.
     */
    @Transactional
    public void revokeEverything(final long userId, final RevokeReason reason) {
        final int sessions = revokeAll(userId, reason, null);
        final long devices = biometricDeviceRepository.deleteByUser_UserId(userId);
        final long pushTokens = pushDeviceTokenRepository.deleteByUserId(userId);
        log.warn("Revoked all credentials for userId={} (reason={}): {} sessions, "
                + "{} biometric devices, {} push tokens", userId, reason, sessions, devices, pushTokens);
    }

    /** Drops a user's biometric enrollments only. */
    @Transactional
    public long revokeBiometricDevices(final long userId) {
        final long removed = biometricDeviceRepository.deleteByUser_UserId(userId);
        log.info("Revoked {} biometric devices for userId={}", removed, userId);
        return removed;
    }

    /** Drops a user's push registrations only — stops notifications reaching an old device. */
    @Transactional
    public long revokePushTokens(final long userId) {
        final long removed = pushDeviceTokenRepository.deleteByUserId(userId);
        log.info("Revoked {} push tokens for userId={}", removed, userId);
        return removed;
    }
}
