package com.db.dbworld.security.auth;

import com.db.dbworld.core.user.entity.UserEntity;
import com.db.dbworld.core.user.service.UserService;
import com.db.dbworld.security.dto.AuthToken;
import com.db.dbworld.security.dto.SessionContext;
import com.db.dbworld.security.dto.BiometricDeviceDto;
import com.db.dbworld.security.entity.BiometricDeviceEntity;
import com.db.dbworld.security.entity.RefreshTokenEntity;
import com.db.dbworld.security.repository.BiometricDeviceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.UUID;

/**
 * Biometric "device token" flow (option B). After a normal password login the client can enroll the
 * device: we mint a high-entropy token, hand back the raw value ONCE (stored on-device behind the
 * fingerprint/face in the hardware Keystore) and persist only its SHA-256 hash. On later launches the
 * client unlocks with biometrics and exchanges the token for a fresh session — no password re-entry
 * and nothing reversible on the server. Tokens are per-device, sliding-expiry, and revocable.
 */
@Log4j2
@Service
@RequiredArgsConstructor
public class BiometricDeviceService {

    /** Sliding lifetime — each successful unlock pushes the expiry out. */
    private static final Duration TTL = Duration.ofDays(90);
    private static final int TOKEN_BYTES = 32;

    private final BiometricDeviceRepository repo;
    private final UserService userService;
    private final AuthenticationService authenticationService;
    private final SecureRandom random = new SecureRandom();

    /** Enrolls (or re-enrolls) the caller's device and returns the raw token exactly once. */
    @Transactional
    public String enroll(String email, String deviceId, String deviceLabel) {
        UserEntity user = userService.getUserEntityByEmail(email);
        String rawToken = randomToken();
        String label = blankToNull(deviceLabel);

        BiometricDeviceEntity e = repo.findByUser_UserIdAndDeviceId(user.getUserId(), deviceId)
                .orElseGet(BiometricDeviceEntity::new);
        e.setUser(user);
        e.setDeviceId(deviceId);
        e.setDeviceLabel(label);
        e.setTokenHash(sha256Hex(rawToken));
        e.setExpiry(Instant.now().plus(TTL));
        e.setLastUsed(null);
        e.setRevoked(false);
        repo.save(e);

        int superseded = revokeSupersededEnrollments(user.getUserId(), deviceId, label);
        log.info("Biometric device enrolled for user [{}] (device={}, supersededStaleEnrollments={})",
                email, deviceId, superseded);
        return rawToken;
    }

    /**
     * Revokes this user's OTHER live enrollments carrying the same device label — rows that
     * describe the same physical handset under a device id it no longer uses.
     *
     * <p>The client's device id used to live in {@code localStorage}, which a Capacitor WebView
     * does not keep: clearing the app's cache, storage pressure, or a reinstall wipes it, and the
     * next enrollment minted a fresh uuid. Since {@code enroll} upserts on
     * {@code (user_id, device_id)}, that produced a NEW row every time instead of updating the
     * existing one — one production account accumulated four rows for a single phone.
     *
     * <p>The clutter is the least of it. Re-enrolling overwrites the Keystore credential, so the
     * superseded token exists on no device at all, yet its row stayed unrevoked and unexpired for
     * the full 90-day TTL: a live credential nothing could present and nothing would retire.
     *
     * <p>Matching on the label is safe precisely because it is specific (it carries the build
     * string, e.g. {@code "SM-S721B Build/BP4A.251205.006"}), and because the only way to reach
     * here is a fresh enrollment from the device that owns that label — whatever token the old row
     * described has already been overwritten in the Keystore. Rows with no label are left alone.
     *
     * @return how many stale enrollments were retired
     */
    private int revokeSupersededEnrollments(long userId, String keepDeviceId, String label) {
        if (label == null) {
            return 0;
        }
        List<BiometricDeviceEntity> stale =
                repo.findByUser_UserIdAndRevokedFalseOrderByCreatedDesc(userId).stream()
                        .filter(d -> !keepDeviceId.equals(d.getDeviceId()))
                        .filter(d -> label.equals(d.getDeviceLabel()))
                        .toList();
        stale.forEach(d -> d.setRevoked(true));
        repo.saveAll(stale);
        return stale.size();
    }

    /** Exchanges a device token for a fresh session (access token + persisted refresh token). */
    @Transactional
    public AuthToken exchange(String rawToken, SessionContext context) {
        BiometricDeviceEntity e = repo.findByTokenHashAndRevokedFalse(sha256Hex(rawToken))
                .filter(d -> d.getExpiry() != null && d.getExpiry().isAfter(Instant.now()))
                .orElseThrow(() -> new BadCredentialsException("Invalid or expired device token"));

        UserEntity user = e.getUser();
        if (!user.isEnabled() || !user.isAccountNonLocked()) {
            throw new DisabledException("Account is disabled");
        }

        e.setLastUsed(Instant.now());
        e.setExpiry(Instant.now().plus(TTL)); // sliding window

        // A biometric unlock RESUMES this device's session; it does not add a second one. Retire
        // the family the previous unlock created before minting the replacement, so an enrolled
        // device holds exactly one live session no matter how often it is unlocked.
        UUID previousFamily = e.getSessionFamilyId();
        AuthToken token = authenticationService.issueSession(user, context);
        e.setSessionFamilyId(token.familyId());
        repo.save(e);

        if (previousFamily != null && !previousFamily.equals(token.familyId())) {
            int retired = authenticationService.revokeFamily(
                    previousFamily, RefreshTokenEntity.RevokeReason.SUPERSEDED);
            log.debug("Biometric unlock retired the device's previous session (family={}, tokens={})",
                    previousFamily, retired);
        }

        log.info("Biometric unlock for user [{}] (device={}, family={})",
                user.getEmail(), e.getDeviceId(), token.familyId());
        return token;
    }

    /** Revokes one device for the caller (settings toggle / logout). */
    @Transactional
    public void revoke(String email, String deviceId) {
        UserEntity user = userService.getUserEntityByEmail(email);
        repo.findByUser_UserIdAndDeviceId(user.getUserId(), deviceId).ifPresent(repo::delete);
        log.info("Biometric device revoked for user [{}] (device={})", email, deviceId);
    }

    /** Lists the caller's active enrolled devices. */
    public List<BiometricDeviceDto> list(String email) {
        UserEntity user = userService.getUserEntityByEmail(email);
        return repo.findByUser_UserIdAndRevokedFalseOrderByCreatedDesc(user.getUserId())
                .stream()
                .map(d -> new BiometricDeviceDto(d.getDeviceId(), d.getDeviceLabel(),
                        d.getCreated(), d.getLastUsed(), d.getExpiry()))
                .toList();
    }

    private String randomToken() {
        byte[] b = new byte[TOKEN_BYTES];
        random.nextBytes(b);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(b);
    }

    /** SHA-256 hex. The token is 256 bits of entropy, so a plain (unsalted) hash is sufficient. */
    private static String sha256Hex(String s) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(digest.length * 2);
            for (byte x : digest) {
                sb.append(Character.forDigit((x >> 4) & 0xF, 16));
                sb.append(Character.forDigit(x & 0xF, 16));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }

    private static String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }
}
