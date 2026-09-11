package com.db.dbworld.security.auth;

import com.db.dbworld.audit.activity.service.LoginDataService;
import com.db.dbworld.core.user.entity.UserEntity;
import com.db.dbworld.core.user.mapper.UserMapper;
import com.db.dbworld.core.user.service.UserService;
import com.db.dbworld.security.dto.AuthToken;
import com.db.dbworld.security.dto.SessionContext;
import com.db.dbworld.security.entity.RefreshTokenEntity;
import com.db.dbworld.security.entity.RefreshTokenEntity.RevokeReason;
import com.db.dbworld.security.enums.ClientPlatform;
import com.db.dbworld.security.repository.RefreshTokenRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.*;

/**
 * Refresh-token rotation and reuse detection.
 *
 * <p>Rotation is what turns a stolen refresh token from an invisible 30-day foothold into a
 * detectable event, so these tests are mostly about the failure paths.
 */
class AuthenticationServiceRotationTest {

    private static final SessionContext CONTEXT =
            new SessionContext(ClientPlatform.ANDROID, "DBWorldApp/2.0", "10.0.0.5");

    RefreshTokenRepository refreshTokenRepository;
    SessionRevocationService sessionRevocationService;
    JwtService jwtService;
    AuthenticationService service;

    UserEntity user;
    UUID familyId;

    @BeforeEach
    void setUp() {
        refreshTokenRepository = mock(RefreshTokenRepository.class);
        sessionRevocationService = mock(SessionRevocationService.class);
        jwtService = mock(JwtService.class);

        service = new AuthenticationService(
                mock(AuthenticationManager.class),
                jwtService,
                mock(LoginDataService.class),
                mock(UserService.class),
                refreshTokenRepository,
                sessionRevocationService,
                mock(UserMapper.class));

        user = new UserEntity();
        user.setUserId(42L);
        user.setEmail("a@b.com");
        user.setEnabled(true);
        user.setAccountNonLocked(true);

        familyId = UUID.randomUUID();
        when(jwtService.generateToken(any())).thenReturn("new-access-token");
        // Stand in for @GeneratedValue(strategy = UUID): the service reads getId() off the
        // successor right after saving it, so a mock that returns the row untouched would leave
        // that null and fail for a reason the production path never hits.
        when(refreshTokenRepository.save(any())).thenAnswer(inv -> {
            RefreshTokenEntity saved = inv.getArgument(0);
            if (saved.getId() == null) saved.setId(UUID.randomUUID());
            return saved;
        });
    }

    private RefreshTokenEntity liveToken() {
        RefreshTokenEntity token = new RefreshTokenEntity();
        token.setId(UUID.randomUUID());
        token.setFamilyId(familyId);
        token.setUser(user);
        token.setExpiry(Instant.now().plus(30, ChronoUnit.DAYS));
        token.setRefreshCount(2);
        token.setUserAgent("Chrome");
        token.setIpAddress("1.2.3.4");
        return token;
    }

    private void present(RefreshTokenEntity token) {
        when(refreshTokenRepository.findByIdWithUser(token.getId())).thenReturn(Optional.of(token));
    }

    @Test
    void refreshSpendsThePresentedTokenAndIssuesASuccessorInTheSameFamily() {
        RefreshTokenEntity presented = liveToken();
        present(presented);

        AuthToken result = service.refreshToken(presented.getId().toString(), CONTEXT);

        assertThat(presented.getUsedAt()).as("presented token must be spent").isNotNull();

        ArgumentCaptor<RefreshTokenEntity> saved = ArgumentCaptor.forClass(RefreshTokenEntity.class);
        verify(refreshTokenRepository, times(2)).save(saved.capture());
        RefreshTokenEntity successor = saved.getAllValues().getLast();

        assertThat(successor.getFamilyId()).isEqualTo(familyId);
        assertThat(successor.getId()).isNotEqualTo(presented.getId());
        assertThat(result.familyId()).isEqualTo(familyId);
        assertThat(result.accessToken()).isEqualTo("new-access-token");
    }

    /** Rotation must not let a session renew itself past the 30 days it was granted. */
    @Test
    void successorInheritsTheOriginalExpiryRatherThanExtendingIt() {
        RefreshTokenEntity presented = liveToken();
        Instant originalExpiry = presented.getExpiry();
        present(presented);

        service.refreshToken(presented.getId().toString(), CONTEXT);

        ArgumentCaptor<RefreshTokenEntity> saved = ArgumentCaptor.forClass(RefreshTokenEntity.class);
        verify(refreshTokenRepository, times(2)).save(saved.capture());
        assertThat(saved.getAllValues().getLast().getExpiry()).isEqualTo(originalExpiry);
    }

    /**
     * The core of reuse detection: a token that has already been spent coming back means either
     * the thief or the victim is replaying it, and we cannot tell which — so everything goes.
     */
    @Test
    void replayingASpentTokenRevokesEverythingAndFails() {
        RefreshTokenEntity spent = liveToken();
        spent.setUsedAt(Instant.now().minusSeconds(60));
        present(spent);

        assertThatThrownBy(() -> service.refreshToken(spent.getId().toString(), CONTEXT))
                .isInstanceOf(BadCredentialsException.class);

        verify(sessionRevocationService).revokeAll(42L, RevokeReason.REUSE_DETECTED, null);
    }

    @Test
    void revokedTokenIsRejectedWithoutTriggeringReuseHandling() {
        RefreshTokenEntity revoked = liveToken();
        revoked.revoke(RevokeReason.LOGOUT, Instant.now());
        present(revoked);

        assertThatThrownBy(() -> service.refreshToken(revoked.getId().toString(), CONTEXT))
                .isInstanceOf(BadCredentialsException.class);

        verify(sessionRevocationService, never()).revokeAll(anyLong(), any(), any());
    }

    @Test
    void expiredTokenIsRejected() {
        RefreshTokenEntity expired = liveToken();
        expired.setExpiry(Instant.now().minusSeconds(1));
        present(expired);

        assertThatThrownBy(() -> service.refreshToken(expired.getId().toString(), CONTEXT))
                .isInstanceOf(BadCredentialsException.class);
    }

    @Test
    void disabledAccountCannotRefresh() {
        user.setEnabled(false);
        RefreshTokenEntity token = liveToken();
        present(token);

        assertThatThrownBy(() -> service.refreshToken(token.getId().toString(), CONTEXT))
                .isInstanceOf(DisabledException.class);
    }

    /** A deleted account must go through a fresh sign-in, which is also what restores it. */
    @Test
    void accountPendingDeletionCannotRefresh() {
        user.setDeletedAt(Instant.now());
        user.setPurgeAfter(Instant.now().plus(30, ChronoUnit.DAYS));
        RefreshTokenEntity token = liveToken();
        present(token);

        assertThatThrownBy(() -> service.refreshToken(token.getId().toString(), CONTEXT))
                .isInstanceOf(DisabledException.class);
    }

    @Test
    void unknownTokenIsRejected() {
        UUID unknown = UUID.randomUUID();
        when(refreshTokenRepository.findByIdWithUser(unknown)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.refreshToken(unknown.toString(), CONTEXT))
                .isInstanceOf(BadCredentialsException.class);
    }

    @Test
    void aTokenThatIsNotEvenAUuidIsRejectedCleanly() {
        assertThatThrownBy(() -> service.refreshToken("not-a-uuid", CONTEXT))
                .isInstanceOf(BadCredentialsException.class);
    }

    /** On rotation the client does not resend device details, so they carry over. */
    @Test
    void successorInheritsDeviceMetadataWhenTheRequestDoesNotCarryIt() {
        RefreshTokenEntity presented = liveToken();
        present(presented);

        service.refreshToken(presented.getId().toString(),
                new SessionContext(ClientPlatform.WEB, "unknown", null));

        ArgumentCaptor<RefreshTokenEntity> saved = ArgumentCaptor.forClass(RefreshTokenEntity.class);
        verify(refreshTokenRepository, times(2)).save(saved.capture());
        RefreshTokenEntity successor = saved.getAllValues().getLast();

        assertThat(successor.getUserAgent()).isEqualTo("Chrome");
        assertThat(successor.getIpAddress()).isEqualTo("1.2.3.4");
    }

    @Test
    void logoutRevokesTheWholeFamilyNotJustThePresentedToken() {
        RefreshTokenEntity token = liveToken();
        present(token);

        service.revokeRefreshToken(token.getId().toString());

        verify(refreshTokenRepository).revokeFamily(eq(familyId), eq(RevokeReason.LOGOUT), any());
    }

    @Test
    void resolveFamilyIdReturnsNullForGarbageRatherThanThrowing() {
        assertThat(service.resolveFamilyId("not-a-uuid")).isNull();
        assertThat(service.resolveFamilyId(null)).isNull();
        assertThat(service.resolveFamilyId("  ")).isNull();
    }
}
