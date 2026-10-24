package com.db.dbworld.app.pm.repository;

import com.db.dbworld.app.pm.dto.CredentialDto;
import com.db.dbworld.app.pm.dto.PasswordHistoryDto;
import com.db.dbworld.app.pm.entity.CredentialEntity;
import com.db.dbworld.app.pm.entity.CredentialHistoryEntity;
import com.db.dbworld.app.pm.entity.CustomFieldEntity;
import com.db.dbworld.app.pm.entity.HostEntity;
import com.db.dbworld.app.pm.entity.PasswordManagerEntity;
import com.db.dbworld.app.pm.mapper.PasswordManagerMapperImpl;
import com.db.dbworld.app.pm.service.impl.PasswordManagerServiceImpl;
import com.db.dbworld.config.JasyptProperties;
import com.db.dbworld.core.context.UserContext;
import com.db.dbworld.core.role.entity.RoleEntity;
import com.db.dbworld.core.role.enums.Role;
import com.db.dbworld.core.user.entity.UserEntity;
import com.db.dbworld.core.user.service.AccountDeletionService;
import org.springframework.test.util.ReflectionTestUtils;
import com.db.dbworld.core.user.service.UserService;
import com.db.dbworld.security.crypto.CryptoProvider;
import com.db.dbworld.security.crypto.StringCryptoConverter;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.cache.CacheManager;
import org.springframework.cache.support.NoOpCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.test.context.ActiveProfiles;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Runs the password-history statements and the service's removal and trimming against real tables.
 * The service tests mock the repositories, so the foreign key from history to its entry, the
 * encrypted column and the "delete first" statement would otherwise never execute. The service is
 * built here over the real repositories (no Spring proxy, so no extra transaction: the test's own
 * transaction is the one it runs in).
 */
@DataJpaTest
@ActiveProfiles("test")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@DisplayName("Vault password history")
class CredentialHistoryJpaTest {

    @TestConfiguration
    static class CacheStubConfig {
        @Bean
        CacheManager cacheManager() {
            return new NoOpCacheManager();
        }
    }

    private static final Instant NOW = Instant.parse("2026-10-24T10:00:00Z");

    @Autowired private EntityManager em;
    @Autowired private CredentialsRepository credentials;
    @Autowired private PasswordManagerRepository groups;
    @Autowired private HostRepository hosts;
    @Autowired private CredentialHistoryRepository history;

    private RoleEntity role;

    @BeforeEach
    void cryptoForTheConverter() {
        role = null;
        // Credential fields are encrypted by a converter that reads a static provider.
        StringCryptoConverter.setCryptoProvider(new CryptoProvider(new JasyptProperties("test-secret", null, null)));
    }

    private UserEntity user(String email) {
        if (role == null) {   // role names are unique: one role, shared by this test's users
            role = new RoleEntity();
            role.setName(Role.VIEWER);
            em.persist(role);
        }
        UserEntity u = new UserEntity();
        u.setEmail(email);
        u.setRole(role);
        em.persist(u);
        return u;
    }

    private PasswordManagerEntity group(UserEntity owner, String host) {
        HostEntity h = em.find(HostEntity.class, host);
        if (h == null) {
            h = new HostEntity(host);
            em.persist(h);
        }
        PasswordManagerEntity pm = new PasswordManagerEntity();
        pm.setHost(h);
        pm.setUserEntity(owner);
        pm.setCredentials(new ArrayList<>());
        em.persist(pm);
        return pm;
    }

    private CredentialEntity credential(PasswordManagerEntity pm, String username, String password, Instant trashedAt) {
        CredentialEntity c = new CredentialEntity();
        c.setName(username);
        c.setUsername(username);
        c.setPassword(password);
        c.setDeletedAt(trashedAt);
        c.setPasswordManager(pm);
        pm.getCredentials().add(c);
        em.persist(c);
        return c;
    }

    private CredentialHistoryEntity row(CredentialEntity c, String password, Instant at) {
        CredentialHistoryEntity h = new CredentialHistoryEntity(c, password, at);
        em.persist(h);
        return h;
    }

    private long historyRowCount() {
        return em.createQuery("select count(h) from CredentialHistoryEntity h", Long.class).getSingleResult();
    }

    private PasswordManagerServiceImpl serviceFor(UserEntity me, Clock clock) {
        UserContext userContext = mock(UserContext.class);
        when(userContext.userId()).thenReturn(me.getUserId());
        return new PasswordManagerServiceImpl(groups, hosts, credentials, history,
                mock(UserService.class), userContext, new PasswordManagerMapperImpl(), clock);
    }

    @Test
    void anOldPasswordRoundTripsThroughTheEncryptedColumnAndComesBackNewestFirst() {
        UserEntity me = user("me@x.com");
        CredentialEntity c = credential(group(me, "netflix.com"), "me", "now", null);
        row(c, "older", NOW.minusSeconds(60));
        row(c, "newer", NOW);
        em.flush();
        em.clear();

        var rows = history.findAllByCredentialIdOrderByChangedAtDescIdDesc(c.getId());

        assertThat(rows).extracting(CredentialHistoryEntity::getPassword).containsExactly("newer", "older");
        assertThat(rows.get(0).getChangedAt()).isEqualTo(NOW);
        // The column holds ciphertext, not the password.
        Object raw = em.createNativeQuery("select password from db_world.credential_history where id = :id")
                .setParameter("id", rows.get(0).getId()).getSingleResult();
        assertThat(String.valueOf(raw)).doesNotContain("newer");
    }

    @Test
    void aHistoryRowIsFoundOnlyThroughItsOwnEntry() {
        UserEntity me = user("me@x.com");
        PasswordManagerEntity pm = group(me, "netflix.com");
        CredentialEntity mine = credential(pm, "a", "pw", null);
        CredentialEntity other = credential(pm, "b", "pw", null);
        CredentialHistoryEntity r = row(mine, "old", NOW);
        em.flush();
        em.clear();

        assertThat(history.findByIdAndCredentialId(r.getId(), mine.getId())).isPresent();
        assertThat(history.findByIdAndCredentialId(r.getId(), other.getId())).isEmpty();
    }

    @Test
    void anEntryCannotBeDeletedWhileItStillHasHistory() {
        // Proves the foreign key is real, so the next test's "delete the history first" is load-bearing.
        UserEntity me = user("me@x.com");
        PasswordManagerEntity pm = group(me, "netflix.com");
        CredentialEntity c = credential(pm, "me", "now", NOW);
        row(c, "old", NOW);
        em.flush();

        pm.getCredentials().remove(c);   // as removeForGood does: the group would otherwise re-save it
        credentials.delete(c);

        assertThatThrownBy(() -> em.flush()).isInstanceOf(RuntimeException.class);
    }

    @Test
    void purgingATrashedEntryDeletesItsHistoryAndTheEntryWithoutAForeignKeyError() {
        UserEntity me = user("me@x.com");
        UserEntity other = user("other@x.com");
        PasswordManagerEntity pm = group(me, "netflix.com");
        CredentialEntity gone = credential(pm, "gone", "now", NOW);
        row(gone, "old1", NOW.minusSeconds(60));
        row(gone, "old2", NOW);
        CredentialEntity othersEntry = credential(group(other, "x.com"), "theirs", "now", null);
        CredentialHistoryEntity othersRow = row(othersEntry, "theirs-old", NOW);
        em.flush();
        em.clear();

        serviceFor(me, Clock.fixed(NOW, ZoneOffset.UTC)).purge(gone.getId());
        em.flush();   // would throw on a foreign key violation
        em.clear();

        assertThat(em.find(CredentialEntity.class, gone.getId())).isNull();
        assertThat(history.findAllByCredentialIdOrderByChangedAtDescIdDesc(gone.getId())).isEmpty();
        assertThat(em.find(PasswordManagerEntity.class, pm.getId())).isNull();   // its last entry went
        assertThat(historyRowCount()).isEqualTo(1);                               // the other user's row stays
        assertThat(em.find(CredentialHistoryEntity.class, othersRow.getId())).isNotNull();
    }

    @Test
    void theDailyPurgeDeletesTheHistoryOfEveryExpiredEntry() {
        UserEntity me = user("me@x.com");
        PasswordManagerEntity pm = group(me, "netflix.com");
        CredentialEntity expired = credential(pm, "expired", "now", NOW.minus(Duration.ofDays(31)));
        CredentialEntity recent = credential(pm, "recent", "now", NOW.minus(Duration.ofDays(2)));
        row(expired, "old", NOW);
        CredentialHistoryEntity keep = row(recent, "old", NOW);
        em.flush();
        em.clear();

        int removed = serviceFor(me, Clock.fixed(NOW, ZoneOffset.UTC)).purgeTrashedBefore(NOW.minus(Duration.ofDays(30)));
        em.flush();
        em.clear();

        assertThat(removed).isEqualTo(1);
        assertThat(history.findAllByCredentialIdOrderByChangedAtDescIdDesc(expired.getId())).isEmpty();
        assertThat(em.find(CredentialHistoryEntity.class, keep.getId())).isNotNull();
    }

    @Test
    void changingThePasswordSevenTimesLeavesTheNewestFiveAndRestoreSwapsOne() {
        UserEntity me = user("me@x.com");
        PasswordManagerEntity pm = group(me, "netflix.com");
        CredentialEntity c = credential(pm, "me", "pw0", null);
        em.flush();
        em.clear();
        AtomicInteger minute = new AtomicInteger();
        Clock ticking = new Clock() {
            @Override public ZoneId getZone() { return ZoneOffset.UTC; }
            @Override public Clock withZone(ZoneId zone) { return this; }
            @Override public Instant instant() { return NOW.plus(Duration.ofMinutes(minute.incrementAndGet())); }
        };
        PasswordManagerServiceImpl service = serviceFor(me, ticking);

        for (int i = 1; i <= 7; i++) {
            CredentialDto d = new CredentialDto();
            d.setId(c.getId());
            d.setName("me");
            d.setUsername("me");
            d.setPassword("pw" + i);
            service.updateCredential(pm.getId(), d);
            em.flush();
            em.clear();
        }

        assertThat(service.getHistory(c.getId())).extracting(PasswordHistoryDto::password)
                .containsExactly("pw6", "pw5", "pw4", "pw3", "pw2");
        assertThat(historyRowCount()).isEqualTo(5);

        service.restorePassword(c.getId(), service.getHistory(c.getId()).get(4).id());   // pw2 comes back
        em.flush();
        em.clear();

        assertThat(em.find(CredentialEntity.class, c.getId()).getPassword()).isEqualTo("pw2");
        assertThat(service.getHistory(c.getId())).extracting(PasswordHistoryDto::password)
                .containsExactly("pw7", "pw6", "pw5", "pw4", "pw3");
    }

    @Test
    @SuppressWarnings("unchecked")
    void theAccountPurgeSqlClearsTheVaultChildRowsSoTheGroupCanBeDeleted() {
        UserEntity me = user("me@x.com");
        UserEntity other = user("other@x.com");
        PasswordManagerEntity pm = group(me, "netflix.com");
        CredentialEntity c = credential(pm, "me", "now", null);
        row(c, "old1", NOW.minusSeconds(60));
        row(c, "old2", NOW);
        em.persist(new CustomFieldEntity("Token", "s3cret", c));
        CredentialEntity othersEntry = credential(group(other, "x.com"), "theirs", "now", null);
        CredentialHistoryEntity othersRow = row(othersEntry, "theirs-old", NOW);
        em.flush();
        em.clear();
        // The purge's SQL names tables without a schema; the test database keeps them in db_world.
        em.createNativeQuery("SET SCHEMA_SEARCH_PATH db_world, PUBLIC").executeUpdate();

        // The statements AccountDeletionService runs, in its order, ahead of "DELETE FROM PASSWORD_MANAGER".
        // That last statement is not run here: H2 reads its bare `user` column as the USER() function.
        List<String> vaultSql = (List<String>) ReflectionTestUtils.getField(AccountDeletionService.class, "VAULT_PURGE_SQL");
        assertThat(vaultSql).hasSize(3);
        int groupsDeleted;
        try {
            for (String sql : vaultSql) {
                em.createNativeQuery(sql).setParameter("userId", me.getUserId()).executeUpdate();
            }
            // With the child rows gone the group delete is no longer refused by a foreign key.
            groupsDeleted = em.createNativeQuery("DELETE FROM PASSWORD_MANAGER WHERE id = :id")
                    .setParameter("id", pm.getId()).executeUpdate();
        } finally {
            em.createNativeQuery("SET SCHEMA_SEARCH_PATH PUBLIC").executeUpdate();   // the setting outlives the test
        }
        em.clear();

        assertThat(groupsDeleted).isEqualTo(1);
        assertThat(em.find(CredentialEntity.class, c.getId())).isNull();
        assertThat(em.createQuery("select count(f) from CustomFieldEntity f", Long.class).getSingleResult()).isZero();
        assertThat(historyRowCount()).isEqualTo(1);   // only the other user's row is left
        assertThat(em.find(CredentialHistoryEntity.class, othersRow.getId())).isNotNull();
        assertThat(em.find(CredentialEntity.class, othersEntry.getId())).isNotNull();
    }
}
