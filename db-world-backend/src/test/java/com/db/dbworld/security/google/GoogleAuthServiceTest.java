package com.db.dbworld.security.google;

import com.db.dbworld.core.exception.DbWorldException;
import com.db.dbworld.core.role.entity.RoleEntity;
import com.db.dbworld.core.role.enums.Role;
import com.db.dbworld.core.role.repository.UserRoleRepository;
import com.db.dbworld.core.user.entity.UserEntity;
import com.db.dbworld.core.user.repository.UserRepository;
import com.db.dbworld.security.auth.AuthenticationService;
import com.db.dbworld.security.dto.AuthToken;
import com.db.dbworld.security.dto.SessionContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.LockedException;

import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Account resolution for Google sign-in — the linking rules, which is where the security
 * decisions live. Token verification itself is covered by the audience/issuer validators
 * inside {@link GoogleIdTokenVerifier}; here it is mocked so these tests can focus on which
 * account a verified identity ends up attached to.
 */
class GoogleAuthServiceTest {

    private static final SessionContext CONTEXT = SessionContext.unknown();
    private static final String SUB = "google-sub-123";

    GoogleIdTokenVerifier verifier;
    UserRepository userRepository;
    UserRoleRepository roleRepository;
    AuthenticationService authenticationService;
    GoogleAuthService service;

    RoleEntity viewer;

    @BeforeEach
    void setUp() {
        verifier = mock(GoogleIdTokenVerifier.class);
        userRepository = mock(UserRepository.class);
        roleRepository = mock(UserRoleRepository.class);
        authenticationService = mock(AuthenticationService.class);
        service = new GoogleAuthService(verifier, userRepository, roleRepository, authenticationService);

        viewer = new RoleEntity();
        viewer.setName(Role.VIEWER);
        when(roleRepository.findByName(Role.VIEWER)).thenReturn(viewer);

        when(verifier.verify("token")).thenReturn(new GoogleIdentity(
                SUB, "user@gmail.com", true, "Bhavya Dudhia", "Bhavya", "Dudhia",
                "https://pic"));

        when(userRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(authenticationService.issueSession(any(), any())).thenReturn(
                new AuthToken("access", "refresh", UUID.randomUUID(), Duration.ofDays(30), null));
    }

    private UserEntity existingUser() {
        UserEntity user = new UserEntity();
        user.setUserId(5L);
        user.setEmail("user@gmail.com");
        user.setRole(viewer);
        user.setEnabled(true);
        user.setAccountNonLocked(true);
        return user;
    }

    @Test
    void createsAnAccountWhenNeitherSubNorEmailMatches() {
        when(userRepository.findByGoogleSub(SUB)).thenReturn(Optional.empty());
        when(userRepository.findByEmail("user@gmail.com")).thenReturn(Optional.empty());

        service.signIn("token", CONTEXT);

        ArgumentCaptor<UserEntity> saved = ArgumentCaptor.forClass(UserEntity.class);
        verify(userRepository).save(saved.capture());
        UserEntity created = saved.getValue();

        assertThat(created.getEmail()).isEqualTo("user@gmail.com");
        assertThat(created.getGoogleSub()).isEqualTo(SUB);
        assertThat(created.isEmailVerified()).isTrue();
        assertThat(created.getRole().getName()).isEqualTo(Role.VIEWER);
        assertThat(created.getFirstName()).isEqualTo("Bhavya");
        assertThat(created.getLastName()).isEqualTo("Dudhia");
    }

    /**
     * A Google-created account must have NO password. Storing an encoded empty string or a
     * placeholder would create a credential nobody chose, which the password login path could
     * then be coaxed into matching.
     */
    @Test
    void createdAccountHasNoPasswordCredential() {
        when(userRepository.findByGoogleSub(SUB)).thenReturn(Optional.empty());
        when(userRepository.findByEmail("user@gmail.com")).thenReturn(Optional.empty());

        service.signIn("token", CONTEXT);

        ArgumentCaptor<UserEntity> saved = ArgumentCaptor.forClass(UserEntity.class);
        verify(userRepository).save(saved.capture());
        assertThat(saved.getValue().hasPassword()).isFalse();
    }

    @Test
    void linksToAnExistingPasswordAccountWithTheSameVerifiedEmail() {
        UserEntity existing = existingUser();
        when(userRepository.findByGoogleSub(SUB)).thenReturn(Optional.empty());
        when(userRepository.findByEmail("user@gmail.com")).thenReturn(Optional.of(existing));

        service.signIn("token", CONTEXT);

        assertThat(existing.getGoogleSub()).isEqualTo(SUB);
        assertThat(existing.isEmailVerified()).isTrue();
        verify(authenticationService).issueSession(existing, CONTEXT);
    }

    /**
     * The email matches but a DIFFERENT Google account already owns it. Linking anyway would
     * hand the account to whoever holds the newer identity, so this must refuse.
     */
    @Test
    void refusesWhenTheEmailIsAlreadyLinkedToADifferentGoogleAccount() {
        UserEntity existing = existingUser();
        existing.setGoogleSub("some-other-sub");
        when(userRepository.findByGoogleSub(SUB)).thenReturn(Optional.empty());
        when(userRepository.findByEmail("user@gmail.com")).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> service.signIn("token", CONTEXT))
                .isInstanceOf(DbWorldException.class)
                .hasMessageContaining("already linked");

        verify(authenticationService, never()).issueSession(any(), any());
    }

    /** Matching on sub rather than email is what survives a user changing their Google address. */
    @Test
    void matchesOnSubEvenWhenTheEmailHasChangedOnGoogleSide() {
        UserEntity existing = existingUser();
        existing.setEmail("old@gmail.com");
        existing.setGoogleSub(SUB);
        when(userRepository.findByGoogleSub(SUB)).thenReturn(Optional.of(existing));

        service.signIn("token", CONTEXT);

        verify(userRepository, never()).findByEmail(any());
        verify(authenticationService).issueSession(existing, CONTEXT);
    }

    @Test
    void disabledAccountCannotSignInWithGoogle() {
        UserEntity existing = existingUser();
        existing.setGoogleSub(SUB);
        existing.setEnabled(false);
        when(userRepository.findByGoogleSub(SUB)).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> service.signIn("token", CONTEXT))
                .isInstanceOf(DisabledException.class);
    }

    @Test
    void lockedAccountCannotSignInWithGoogle() {
        UserEntity existing = existingUser();
        existing.setGoogleSub(SUB);
        existing.setAccountNonLocked(false);
        when(userRepository.findByGoogleSub(SUB)).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> service.signIn("token", CONTEXT))
                .isInstanceOf(LockedException.class);
    }

    /** Signing back in undoes a deletion — that has to work through Google, not just a password. */
    @Test
    void signingInRestoresAnAccountInsideItsDeletionGraceWindow() {
        UserEntity existing = existingUser();
        existing.setGoogleSub(SUB);
        existing.setDeletedAt(Instant.now());
        existing.setPurgeAfter(Instant.now().plus(30, ChronoUnit.DAYS));
        existing.setEnabled(false);
        when(userRepository.findByGoogleSub(SUB)).thenReturn(Optional.of(existing));

        service.signIn("token", CONTEXT);

        assertThat(existing.isPendingDeletion()).isFalse();
        assertThat(existing.getPurgeAfter()).isNull();
        assertThat(existing.isEnabled()).isTrue();
        verify(authenticationService).issueSession(existing, CONTEXT);
    }

    /** Google may send only a full `name`; it has to be split rather than dropped. */
    @Test
    void derivesFirstAndLastNameWhenOnlyTheFullNameIsPresent() {
        when(verifier.verify("token")).thenReturn(new GoogleIdentity(
                SUB, "user@gmail.com", true, "Bhavya Dudhia", null, null, null));
        when(userRepository.findByGoogleSub(SUB)).thenReturn(Optional.empty());
        when(userRepository.findByEmail("user@gmail.com")).thenReturn(Optional.empty());

        service.signIn("token", CONTEXT);

        ArgumentCaptor<UserEntity> saved = ArgumentCaptor.forClass(UserEntity.class);
        verify(userRepository).save(saved.capture());
        assertThat(saved.getValue().getFirstName()).isEqualTo("Bhavya");
        assertThat(saved.getValue().getLastName()).isEqualTo("Dudhia");
    }

    /** The columns cap at 20 characters, so a long Google name must not blow up the insert. */
    @Test
    void truncatesNamesToTheColumnWidth() {
        when(verifier.verify("token")).thenReturn(new GoogleIdentity(
                SUB, "user@gmail.com", true, null,
                "Bartholomew-Maximilian-Reginald", "Featherstonehaugh-Villiers", null));
        when(userRepository.findByGoogleSub(SUB)).thenReturn(Optional.empty());
        when(userRepository.findByEmail("user@gmail.com")).thenReturn(Optional.empty());

        service.signIn("token", CONTEXT);

        ArgumentCaptor<UserEntity> saved = ArgumentCaptor.forClass(UserEntity.class);
        verify(userRepository).save(saved.capture());
        assertThat(saved.getValue().getFirstName()).hasSizeLessThanOrEqualTo(20);
        assertThat(saved.getValue().getLastName()).hasSizeLessThanOrEqualTo(20);
    }
}
