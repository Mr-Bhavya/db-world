package com.db.dbworld.core.user.service;

import com.db.dbworld.core.exception.DbWorldException;
import com.db.dbworld.core.role.entity.RoleEntity;
import com.db.dbworld.core.role.enums.Role;
import com.db.dbworld.core.user.entity.UserEntity;
import com.db.dbworld.core.user.repository.UserRepository;
import com.db.dbworld.security.auth.SessionRevocationService;
import com.db.dbworld.security.entity.RefreshTokenEntity.RevokeReason;
import com.db.dbworld.security.repository.RefreshTokenRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

class AccountDeletionServiceTest {

    UserRepository userRepository;
    RefreshTokenRepository refreshTokenRepository;
    SessionRevocationService sessionRevocationService;
    EntityManager entityManager;
    AccountDeletionService service;

    UserEntity user;
    List<String> executedSql;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        refreshTokenRepository = mock(RefreshTokenRepository.class);
        sessionRevocationService = mock(SessionRevocationService.class);
        entityManager = mock(EntityManager.class);

        service = new AccountDeletionService(
                userRepository, refreshTokenRepository, sessionRevocationService);
        ReflectionTestUtils.setField(service, "entityManager", entityManager);

        executedSql = new ArrayList<>();
        Query query = mock(Query.class);
        when(query.setParameter(anyString(), any())).thenReturn(query);
        when(query.executeUpdate()).thenReturn(1);
        when(entityManager.createNativeQuery(anyString())).thenAnswer(inv -> {
            executedSql.add(inv.getArgument(0));
            return query;
        });

        RoleEntity viewer = new RoleEntity();
        viewer.setName(Role.VIEWER);

        user = new UserEntity();
        user.setUserId(9L);
        user.setEmail("user@example.com");
        user.setRole(viewer);
        user.setEnabled(true);
        when(userRepository.findById(9L)).thenReturn(Optional.of(user));
        when(userRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    // ── Soft delete ────────────────────────────────────────────────────────

    @Test
    void softDeleteStampsTheGraceWindowAndLocksTheUserOutNow() {
        Instant purgeAfter = service.softDelete(9L, "self");

        assertThat(user.isPendingDeletion()).isTrue();
        assertThat(user.isEnabled()).as("disabling is what excludes the account elsewhere").isFalse();
        assertThat(purgeAfter).isCloseTo(
                Instant.now().plus(AccountDeletionService.GRACE_PERIOD),
                within(5, ChronoUnit.SECONDS));

        // Sessions AND biometric/push credentials — a biometric enrollment can mint a brand new
        // session without a password, so revoking sessions alone would not lock anyone out.
        verify(sessionRevocationService).revokeEverything(9L, RevokeReason.ACCOUNT_DELETED);
    }

    @Test
    void softDeleteIsIdempotentAndKeepsTheOriginalDeadline() {
        Instant first = service.softDelete(9L, "self");
        Instant second = service.softDelete(9L, "self");

        assertThat(second).isEqualTo(first);
        verify(sessionRevocationService, times(1)).revokeEverything(anyLong(), any());
    }

    /** Deleting the only admin would lock everyone out of the console. */
    @Test
    void refusesToDeleteTheLastAdmin() {
        RoleEntity admin = new RoleEntity();
        admin.setName(Role.ADMIN);
        user.setRole(admin);
        when(userRepository.countByRoleName(Role.ADMIN)).thenReturn(1L);

        assertThatThrownBy(() -> service.softDelete(9L, "self"))
                .isInstanceOf(DbWorldException.class)
                .hasMessageContaining("last ADMIN");

        assertThat(user.isPendingDeletion()).isFalse();
    }

    @Test
    void allowsDeletingAnAdminWhenAnotherOneRemains() {
        RoleEntity admin = new RoleEntity();
        admin.setName(Role.ADMIN);
        user.setRole(admin);
        when(userRepository.countByRoleName(Role.ADMIN)).thenReturn(2L);

        service.softDelete(9L, "self");

        assertThat(user.isPendingDeletion()).isTrue();
    }

    @Test
    void restoreClearsTheDeletionAndReEnablesTheAccount() {
        service.softDelete(9L, "self");

        service.restore(9L);

        assertThat(user.isPendingDeletion()).isFalse();
        assertThat(user.getPurgeAfter()).isNull();
        assertThat(user.isEnabled()).isTrue();
    }

    // ── Purge ──────────────────────────────────────────────────────────────

    @Test
    void purgeDeletesPrivateDataAndDetachesTheRestBeforeRemovingTheUser() {
        service.purge(9L);

        assertThat(executedSql).anyMatch(sql -> sql.startsWith("DELETE FROM wallet_document"));
        assertThat(executedSql).anyMatch(sql -> sql.startsWith("DELETE FROM PASSWORD_MANAGER"));
        assertThat(executedSql).anyMatch(sql -> sql.contains("UPDATE user_reviews SET user_id = NULL"));
        assertThat(executedSql).anyMatch(sql -> sql.contains("UPDATE LOGIN_DATA SET user = NULL"));

        verify(refreshTokenRepository).deleteByUser_UserId(9L);
        verify(userRepository).delete(user);
    }

    /**
     * Several tables do NOT key on `user_id`. A blanket loop would skip them and silently leave
     * the private data a purge is supposed to erase.
     */
    @Test
    void purgeUsesTheCorrectColumnForTablesThatDoNotUseUserId() {
        service.purge(9L);

        assertThat(executedSql).anyMatch(sql ->
                sql.equals("DELETE FROM wallet_share WHERE created_by_user_id = :userId"));
        assertThat(executedSql).anyMatch(sql ->
                sql.equals("DELETE FROM PASSWORD_MANAGER WHERE user = :userId"));
        assertThat(executedSql).anyMatch(sql ->
                sql.equals("DELETE FROM USER_NOTIFICATIONS WHERE recipient_user_id = :userId"));
        assertThat(executedSql).anyMatch(sql ->
                sql.equals("DELETE FROM USER_NOTIFICATIONS WHERE actor_user_id = :userId"));
    }

    /**
     * Requests belong to everyone who voted on them, so only the user's own votes go — deleting
     * the request rows would destroy other people's data.
     */
    @Test
    void purgeRemovesVotesButNotTheSharedRequestRows() {
        service.purge(9L);

        assertThat(executedSql).anyMatch(sql -> sql.startsWith("DELETE FROM media_request_voters"));
        assertThat(executedSql).noneMatch(sql -> sql.startsWith("DELETE FROM media_requests "));
        assertThat(executedSql).anyMatch(sql ->
                sql.contains("UPDATE media_requests SET fulfilled_by_user_id = NULL"));
    }

    /** Detaching must happen first, or a foreign key could take a kept row with it. */
    @Test
    void detachesBeforeDeleting() {
        service.purge(9L);

        int lastUpdate = lastIndexMatching("UPDATE ");
        int firstDelete = firstIndexMatching("DELETE ");
        assertThat(lastUpdate).isLessThan(firstDelete);
    }

    /** One drifted table must not abort the purge and leave personal data behind. */
    @Test
    void aFailingStatementDoesNotStopTheRestOfThePurge() {
        Query failing = mock(Query.class);
        when(failing.setParameter(anyString(), any())).thenReturn(failing);
        when(failing.executeUpdate()).thenThrow(new IllegalStateException("no such table"));
        when(entityManager.createNativeQuery(argThat(sql ->
                sql != null && sql.contains("SEARCH_HISTORY")))).thenReturn(failing);

        service.purge(9L);

        verify(userRepository).delete(user);
    }

    private int firstIndexMatching(String prefix) {
        for (int i = 0; i < executedSql.size(); i++) {
            if (executedSql.get(i).startsWith(prefix)) return i;
        }
        return Integer.MAX_VALUE;
    }

    private int lastIndexMatching(String prefix) {
        int found = -1;
        for (int i = 0; i < executedSql.size(); i++) {
            if (executedSql.get(i).startsWith(prefix)) found = i;
        }
        return found;
    }
}
