package com.db.dbworld.security.token;

import com.db.dbworld.core.exception.DbWorldException;
import com.db.dbworld.core.mail.MailService;
import com.db.dbworld.core.user.entity.UserEntity;
import com.db.dbworld.core.user.repository.UserRepository;
import com.db.dbworld.security.auth.SessionRevocationService;
import com.db.dbworld.security.entity.RefreshTokenEntity.RevokeReason;
import com.db.dbworld.security.token.VerificationTokenEntity.Purpose;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

class AccountRecoveryServiceTest {

    UserRepository userRepository;
    VerificationTokenRepository tokenRepository;
    SessionRevocationService sessionRevocationService;
    PasswordEncoder passwordEncoder;
    MailService mailService;
    AccountRecoveryService service;

    UserEntity user;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        tokenRepository = mock(VerificationTokenRepository.class);
        sessionRevocationService = mock(SessionRevocationService.class);
        passwordEncoder = mock(PasswordEncoder.class);
        mailService = mock(MailService.class);

        service = new AccountRecoveryService(userRepository, tokenRepository,
                sessionRevocationService, passwordEncoder, mailService);
        ReflectionTestUtils.setField(service, "publicBaseUrl", "https://db-world.in");

        user = new UserEntity();
        user.setUserId(7L);
        user.setEmail("user@example.com");
        user.setPassword("$2a$10$existinghash");
        user.setEnabled(true);

        when(userRepository.findById(7L)).thenReturn(Optional.of(user));
        when(userRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(tokenRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(passwordEncoder.encode(anyString())).thenReturn("$2a$10$newhash");
    }

    private static String sha256Hex(String value) throws Exception {
        return HexFormat.of().formatHex(
                MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
    }

    /** Pulls the raw token out of the emailed link — it exists nowhere else by design. */
    private String captureEmailedToken() {
        ArgumentCaptor<String> body = ArgumentCaptor.forClass(String.class);
        verify(mailService).send(anyString(), anyString(), body.capture());
        String html = body.getValue();
        int at = html.indexOf("token=");
        String rest = html.substring(at + "token=".length());
        return rest.substring(0, rest.indexOf('"'));
    }

    private VerificationTokenEntity storedToken(Purpose purpose, String rawToken) throws Exception {
        VerificationTokenEntity token = new VerificationTokenEntity();
        token.setUser(user);
        token.setPurpose(purpose);
        token.setTokenHash(sha256Hex(rawToken));
        token.setExpiry(Instant.now().plusSeconds(600));
        when(tokenRepository.findByTokenHashWithUser(sha256Hex(rawToken)))
                .thenReturn(Optional.of(token));
        return token;
    }

    // ── Token issuing ─────────────────────────────────────────────────────

    /** The raw token must never be persisted — a DB leak would otherwise be redeemable. */
    @Test
    void onlyTheHashOfTheTokenIsStored() {
        service.sendVerificationEmail(7L);

        String raw = captureEmailedToken();
        ArgumentCaptor<VerificationTokenEntity> saved =
                ArgumentCaptor.forClass(VerificationTokenEntity.class);
        verify(tokenRepository).save(saved.capture());

        assertThat(saved.getValue().getTokenHash()).isNotEqualTo(raw);
        assertThat(saved.getValue().getTokenHash()).hasSize(64);
    }

    /** Issuing a second link must kill the first, or old emails stay redeemable. */
    @Test
    void issuingInvalidatesAnyOutstandingTokenOfTheSamePurpose() {
        service.sendVerificationEmail(7L);

        verify(tokenRepository).invalidateOutstanding(eq(7L), eq(Purpose.EMAIL_VERIFICATION), any());
    }

    @Test
    void alreadyVerifiedAccountIsNotEmailedAgain() {
        user.setEmailVerified(true);

        service.sendVerificationEmail(7L);

        verifyNoInteractions(mailService);
        verify(tokenRepository, never()).save(any());
    }

    // ── Email verification ────────────────────────────────────────────────

    @Test
    void confirmingMarksTheAddressVerifiedAndSpendsTheToken() throws Exception {
        VerificationTokenEntity token = storedToken(Purpose.EMAIL_VERIFICATION, "raw-token");

        service.confirmEmail("raw-token");

        assertThat(user.isEmailVerified()).isTrue();
        assertThat(token.getUsedAt()).isNotNull();
    }

    @Test
    void aSpentTokenCannotBeRedeemedTwice() throws Exception {
        VerificationTokenEntity token = storedToken(Purpose.EMAIL_VERIFICATION, "raw-token");
        token.setUsedAt(Instant.now().minusSeconds(10));

        assertThatThrownBy(() -> service.confirmEmail("raw-token"))
                .isInstanceOf(DbWorldException.class)
                .hasMessageContaining("already been used");
    }

    @Test
    void anExpiredTokenIsRejected() throws Exception {
        VerificationTokenEntity token = storedToken(Purpose.EMAIL_VERIFICATION, "raw-token");
        token.setExpiry(Instant.now().minusSeconds(1));

        assertThatThrownBy(() -> service.confirmEmail("raw-token"))
                .isInstanceOf(DbWorldException.class);
    }

    /** A reset token must not double as a verification token, or the TTLs mean nothing. */
    @Test
    void aTokenIssuedForResetCannotConfirmAnEmail() throws Exception {
        storedToken(Purpose.PASSWORD_RESET, "raw-token");

        assertThatThrownBy(() -> service.confirmEmail("raw-token"))
                .isInstanceOf(DbWorldException.class)
                .hasMessageContaining("not valid");
    }

    // ── Password reset ────────────────────────────────────────────────────

    /**
     * An unknown address must be indistinguishable from a known one. Any difference turns this
     * into a way to enumerate who holds an account.
     */
    @Test
    void requestingAResetForAnUnknownAddressIsSilent() {
        when(userRepository.findByEmail("nobody@example.com")).thenReturn(Optional.empty());

        service.requestPasswordReset("nobody@example.com");

        verifyNoInteractions(mailService);
        verify(tokenRepository, never()).save(any());
    }

    @Test
    void requestingAResetForAKnownAddressEmailsALink() {
        when(userRepository.findByEmail("user@example.com")).thenReturn(Optional.of(user));

        service.requestPasswordReset("user@example.com");

        verify(mailService).send(eq("user@example.com"), anyString(), contains("/reset-password?token="));
    }

    /** Signing in is what restores a deleted account; a reset link must not do it quietly. */
    @Test
    void anAccountPendingDeletionGetsNoResetLink() {
        user.setDeletedAt(Instant.now());
        when(userRepository.findByEmail("user@example.com")).thenReturn(Optional.of(user));

        service.requestPasswordReset("user@example.com");

        verifyNoInteractions(mailService);
    }

    @Test
    void resettingSetsTheNewPasswordAndSignsOutEverywhere() throws Exception {
        storedToken(Purpose.PASSWORD_RESET, "reset-token");

        service.resetPassword("reset-token", "brand-new-password");

        assertThat(user.getPassword()).isEqualTo("$2a$10$newhash");
        // The sign-out is the point: someone resetting usually suspects another party has access.
        verify(sessionRevocationService).revokeEverything(7L, RevokeReason.PASSWORD_CHANGED);
    }

    /** Redeeming the link proved mailbox control, which is what verification asks for. */
    @Test
    void resettingAlsoVerifiesTheAddress() throws Exception {
        storedToken(Purpose.PASSWORD_RESET, "reset-token");
        assertThat(user.isEmailVerified()).isFalse();

        service.resetPassword("reset-token", "brand-new-password");

        assertThat(user.isEmailVerified()).isTrue();
    }

    @Test
    void aTooShortPasswordIsRejectedBeforeTheTokenIsSpent() {
        assertThatThrownBy(() -> service.resetPassword("reset-token", "abc"))
                .isInstanceOf(DbWorldException.class)
                .hasMessageContaining("at least 6");

        verify(tokenRepository, never()).save(any());
        verify(sessionRevocationService, never()).revokeEverything(anyLong(), any());
    }

    @Test
    void anUnknownResetTokenIsRejected() {
        when(tokenRepository.findByTokenHashWithUser(anyString())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.resetPassword("bogus", "brand-new-password"))
                .isInstanceOf(DbWorldException.class);
    }
}
