package com.db.dbworld.security.auth;

import com.db.dbworld.core.user.entity.UserEntity;
import com.db.dbworld.core.user.service.UserService;
import com.db.dbworld.security.dto.AuthToken;
import java.util.UUID;
import com.db.dbworld.security.dto.SessionContext;
import com.db.dbworld.security.dto.BiometricDeviceDto;
import com.db.dbworld.security.entity.BiometricDeviceEntity;
import com.db.dbworld.security.repository.BiometricDeviceRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

class BiometricDeviceServiceTest {

    private static final SessionContext CONTEXT = SessionContext.unknown();


    BiometricDeviceRepository repo;
    UserService userService;
    AuthenticationService authenticationService;
    BiometricDeviceService service;

    UserEntity user;

    @BeforeEach
    void setUp() {
        repo = mock(BiometricDeviceRepository.class);
        userService = mock(UserService.class);
        authenticationService = mock(AuthenticationService.class);
        service = new BiometricDeviceService(repo, userService, authenticationService);

        user = mock(UserEntity.class);
        when(user.getUserId()).thenReturn(1L);
        when(user.getEmail()).thenReturn("a@b.com");
        when(user.isEnabled()).thenReturn(true);
        when(user.isAccountNonLocked()).thenReturn(true);
        when(userService.getUserEntityByEmail("a@b.com")).thenReturn(user);
    }

    private static String sha256Hex(String s) throws Exception {
        byte[] d = MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8));
        StringBuilder sb = new StringBuilder();
        for (byte x : d) sb.append(String.format("%02x", x));
        return sb.toString();
    }

    @Test
    void enroll_storesHashNotRawToken_andReturnsRawOnce() throws Exception {
        when(repo.findByUser_UserIdAndDeviceId(1L, "dev-1")).thenReturn(Optional.empty());

        String raw = service.enroll("a@b.com", "dev-1", "Pixel 8");

        assertThat(raw).isNotBlank();
        ArgumentCaptor<BiometricDeviceEntity> cap = ArgumentCaptor.forClass(BiometricDeviceEntity.class);
        verify(repo).save(cap.capture());
        BiometricDeviceEntity saved = cap.getValue();
        assertThat(saved.getTokenHash()).isEqualTo(sha256Hex(raw)); // stored hash, never the token
        assertThat(saved.getTokenHash()).isNotEqualTo(raw);
        assertThat(saved.getDeviceId()).isEqualTo("dev-1");
        assertThat(saved.getDeviceLabel()).isEqualTo("Pixel 8");
        assertThat(saved.isRevoked()).isFalse();
        assertThat(saved.getExpiry()).isAfter(Instant.now());
    }

    @Test
    void enroll_reusesExistingRowForSameDevice() {
        BiometricDeviceEntity existing = new BiometricDeviceEntity();
        existing.setDeviceId("dev-1");
        when(repo.findByUser_UserIdAndDeviceId(1L, "dev-1")).thenReturn(Optional.of(existing));

        service.enroll("a@b.com", "dev-1", null);

        ArgumentCaptor<BiometricDeviceEntity> cap = ArgumentCaptor.forClass(BiometricDeviceEntity.class);
        verify(repo).save(cap.capture());
        assertThat(cap.getValue()).isSameAs(existing); // re-enroll updates the same row, no duplicate
    }

    @Test
    void exchange_validToken_issuesSessionAndSlidesExpiry() throws Exception {
        String raw = "sometoken";
        BiometricDeviceEntity e = new BiometricDeviceEntity();
        e.setUser(user);
        e.setDeviceId("dev-1");
        e.setExpiry(Instant.now().plus(Duration.ofDays(1)));
        when(repo.findByTokenHashAndRevokedFalse(sha256Hex(raw))).thenReturn(Optional.of(e));
        AuthToken token = new AuthToken("access", "refresh", UUID.randomUUID(), Duration.ofDays(30), null);
        when(authenticationService.issueSession(user, CONTEXT)).thenReturn(token);

        AuthToken result = service.exchange(raw, CONTEXT);

        assertThat(result).isSameAs(token);
        assertThat(e.getLastUsed()).isNotNull();
        assertThat(e.getExpiry()).isAfter(Instant.now().plus(Duration.ofDays(80))); // slid out ~90d
        verify(repo).save(e);
    }

    @Test
    void exchange_unknownOrRevokedToken_throws() {
        when(repo.findByTokenHashAndRevokedFalse(anyString())).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.exchange("bad", CONTEXT)).isInstanceOf(BadCredentialsException.class);
        verify(authenticationService, never()).issueSession(any(), any());
    }

    @Test
    void exchange_expiredToken_throws() throws Exception {
        String raw = "expired";
        BiometricDeviceEntity e = new BiometricDeviceEntity();
        e.setUser(user);
        e.setExpiry(Instant.now().minus(Duration.ofDays(1)));
        when(repo.findByTokenHashAndRevokedFalse(sha256Hex(raw))).thenReturn(Optional.of(e));
        assertThatThrownBy(() -> service.exchange(raw, CONTEXT)).isInstanceOf(BadCredentialsException.class);
    }

    @Test
    void exchange_disabledAccount_throws() throws Exception {
        String raw = "tok";
        UserEntity disabled = mock(UserEntity.class);
        when(disabled.isEnabled()).thenReturn(false);
        when(disabled.isAccountNonLocked()).thenReturn(true);
        BiometricDeviceEntity e = new BiometricDeviceEntity();
        e.setUser(disabled);
        e.setExpiry(Instant.now().plus(Duration.ofDays(1)));
        when(repo.findByTokenHashAndRevokedFalse(sha256Hex(raw))).thenReturn(Optional.of(e));
        assertThatThrownBy(() -> service.exchange(raw, CONTEXT)).isInstanceOf(DisabledException.class);
        verify(authenticationService, never()).issueSession(any(), any());
    }

    @Test
    void revoke_deletesMatchingDevice() {
        BiometricDeviceEntity e = new BiometricDeviceEntity();
        when(repo.findByUser_UserIdAndDeviceId(1L, "dev-1")).thenReturn(Optional.of(e));
        service.revoke("a@b.com", "dev-1");
        verify(repo).delete(e);
    }

    @Test
    void revoke_missingDevice_isNoop() {
        when(repo.findByUser_UserIdAndDeviceId(1L, "dev-x")).thenReturn(Optional.empty());
        service.revoke("a@b.com", "dev-x");
        verify(repo, never()).delete(any());
    }

    @Test
    void list_mapsActiveDevicesToDtos() {
        BiometricDeviceEntity e = new BiometricDeviceEntity();
        e.setDeviceId("dev-1");
        e.setDeviceLabel("Pixel 8");
        e.setExpiry(Instant.now().plus(Duration.ofDays(10)));
        when(repo.findByUser_UserIdAndRevokedFalseOrderByCreatedDesc(1L)).thenReturn(List.of(e));

        List<BiometricDeviceDto> out = service.list("a@b.com");

        assertThat(out).hasSize(1);
        assertThat(out.get(0).deviceId()).isEqualTo("dev-1");
        assertThat(out.get(0).deviceLabel()).isEqualTo("Pixel 8");
    }

    @Test
    void enroll_thenExchange_roundTrips() throws Exception {
        when(repo.findByUser_UserIdAndDeviceId(1L, "dev-1")).thenReturn(Optional.empty());
        String raw = service.enroll("a@b.com", "dev-1", "dev");

        ArgumentCaptor<BiometricDeviceEntity> cap = ArgumentCaptor.forClass(BiometricDeviceEntity.class);
        verify(repo).save(cap.capture());
        BiometricDeviceEntity saved = cap.getValue();
        saved.setUser(user);

        when(repo.findByTokenHashAndRevokedFalse(saved.getTokenHash())).thenReturn(Optional.of(saved));
        when(authenticationService.issueSession(user, CONTEXT)).thenReturn(new AuthToken("a", "r", UUID.randomUUID(), Duration.ofDays(30), null));

        assertThat(service.exchange(raw, CONTEXT)).isNotNull();
    }

    /** An enrolled device that has already unlocked once. */
    private BiometricDeviceEntity enrolled(UUID previousFamily) {
        BiometricDeviceEntity e = new BiometricDeviceEntity();
        e.setUser(user);
        e.setDeviceId("dev-1");
        e.setDeviceLabel("SM-S721B Build/BP4A.251205.006");
        e.setTokenHash("hash");
        e.setExpiry(Instant.now().plus(Duration.ofDays(90)));
        e.setSessionFamilyId(previousFamily);
        return e;
    }

    @Test
    void exchange_retiresTheSessionThisDevicesPreviousUnlockCreated() {
        // THE bug behind 92 live sessions on one account. A biometric unlock resumes a device that
        // already has a session; it must not stack another alongside it. Every orphan left behind
        // stayed a valid credential for the full 30-day refresh TTL.
        UUID previous = UUID.randomUUID();
        UUID fresh = UUID.randomUUID();
        BiometricDeviceEntity device = enrolled(previous);
        when(repo.findByTokenHashAndRevokedFalse(anyString())).thenReturn(Optional.of(device));
        when(authenticationService.issueSession(user, CONTEXT))
                .thenReturn(new AuthToken("a", "r", fresh, Duration.ofDays(30), null));

        service.exchange("raw", CONTEXT);

        verify(authenticationService).revokeFamily(
                previous, com.db.dbworld.security.entity.RefreshTokenEntity.RevokeReason.SUPERSEDED);
        // ...and the device now points at the new one, so the NEXT unlock retires this one.
        assertThat(device.getSessionFamilyId()).isEqualTo(fresh);
    }

    @Test
    void exchange_firstEverUnlock_hasNoPreviousSessionToRetire() {
        UUID fresh = UUID.randomUUID();
        BiometricDeviceEntity device = enrolled(null);
        when(repo.findByTokenHashAndRevokedFalse(anyString())).thenReturn(Optional.of(device));
        when(authenticationService.issueSession(user, CONTEXT))
                .thenReturn(new AuthToken("a", "r", fresh, Duration.ofDays(30), null));

        service.exchange("raw", CONTEXT);

        verify(authenticationService, never()).revokeFamily(any(), any());
        assertThat(device.getSessionFamilyId()).isEqualTo(fresh);
    }

    @Test
    void enroll_retiresAStaleEnrollmentForTheSamePhysicalDevice() {
        // The device id used to live in localStorage, which a Capacitor WebView does not keep. Each
        // wipe minted a new uuid, and since enroll upserts on (userId, deviceId) that meant a whole
        // new row - one account reached four for a single phone. The superseded token exists on no
        // device (setCredentials overwrote it) yet stayed valid for 90 days.
        String label = "SM-S721B Build/BP4A.251205.006";
        BiometricDeviceEntity stale = new BiometricDeviceEntity();
        stale.setDeviceId("old-uuid");
        stale.setDeviceLabel(label);
        BiometricDeviceEntity otherPhone = new BiometricDeviceEntity();
        otherPhone.setDeviceId("tablet");
        otherPhone.setDeviceLabel("SM-X200 Build/UP1A.231005.007");

        when(repo.findByUser_UserIdAndDeviceId(1L, "new-uuid")).thenReturn(Optional.empty());
        when(repo.findByUser_UserIdAndRevokedFalseOrderByCreatedDesc(1L))
                .thenReturn(List.of(stale, otherPhone));

        service.enroll("a@b.com", "new-uuid", label);

        assertThat(stale.isRevoked()).isTrue();
        assertThat(otherPhone.isRevoked()).isFalse();   // a genuinely different device survives
    }

    @Test
    void enroll_withNoDeviceLabel_retiresNothing() {
        // No label means no evidence about which physical device a row describes, and revoking on
        // a guess would sign a real device out of biometrics.
        BiometricDeviceEntity other = new BiometricDeviceEntity();
        other.setDeviceId("old-uuid");
        other.setDeviceLabel(null);
        when(repo.findByUser_UserIdAndDeviceId(1L, "new-uuid")).thenReturn(Optional.empty());
        when(repo.findByUser_UserIdAndRevokedFalseOrderByCreatedDesc(1L)).thenReturn(List.of(other));

        service.enroll("a@b.com", "new-uuid", null);

        assertThat(other.isRevoked()).isFalse();
    }
}
