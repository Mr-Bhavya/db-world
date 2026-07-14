package com.db.dbworld.security.auth;

import com.db.dbworld.core.user.entity.UserEntity;
import com.db.dbworld.core.user.service.UserService;
import com.db.dbworld.security.dto.AuthToken;
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
        AuthToken token = new AuthToken("access", "refresh", Duration.ofDays(30), null);
        when(authenticationService.issueSession(user)).thenReturn(token);

        AuthToken result = service.exchange(raw);

        assertThat(result).isSameAs(token);
        assertThat(e.getLastUsed()).isNotNull();
        assertThat(e.getExpiry()).isAfter(Instant.now().plus(Duration.ofDays(80))); // slid out ~90d
        verify(repo).save(e);
    }

    @Test
    void exchange_unknownOrRevokedToken_throws() {
        when(repo.findByTokenHashAndRevokedFalse(anyString())).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.exchange("bad")).isInstanceOf(BadCredentialsException.class);
        verify(authenticationService, never()).issueSession(any());
    }

    @Test
    void exchange_expiredToken_throws() throws Exception {
        String raw = "expired";
        BiometricDeviceEntity e = new BiometricDeviceEntity();
        e.setUser(user);
        e.setExpiry(Instant.now().minus(Duration.ofDays(1)));
        when(repo.findByTokenHashAndRevokedFalse(sha256Hex(raw))).thenReturn(Optional.of(e));
        assertThatThrownBy(() -> service.exchange(raw)).isInstanceOf(BadCredentialsException.class);
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
        assertThatThrownBy(() -> service.exchange(raw)).isInstanceOf(DisabledException.class);
        verify(authenticationService, never()).issueSession(any());
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
        when(authenticationService.issueSession(user)).thenReturn(new AuthToken("a", "r", Duration.ofDays(30), null));

        assertThat(service.exchange(raw)).isNotNull();
    }
}
