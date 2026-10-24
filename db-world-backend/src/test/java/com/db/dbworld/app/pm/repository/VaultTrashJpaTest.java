package com.db.dbworld.app.pm.repository;

import com.db.dbworld.app.pm.entity.CredentialEntity;
import com.db.dbworld.app.pm.entity.HostEntity;
import com.db.dbworld.app.pm.entity.PasswordManagerEntity;
import com.db.dbworld.config.JasyptProperties;
import com.db.dbworld.core.role.entity.RoleEntity;
import com.db.dbworld.core.role.enums.Role;
import com.db.dbworld.core.user.entity.UserEntity;
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

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Runs the Trash queries against real tables: the {@code deleted_at} mapping, the per-user lookup,
 * the purge job's "trashed before" lookup and the hub's count of groups that still hold a live entry.
 * The service tests mock the repositories, so none of these statements would otherwise execute.
 */
@DataJpaTest
@ActiveProfiles("test")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@DisplayName("Vault trash repositories")
class VaultTrashJpaTest {

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

    @BeforeEach
    void cryptoForTheConverter() {
        role = null;
        // Credential fields are encrypted by a converter that reads a static provider.
        StringCryptoConverter.setCryptoProvider(new CryptoProvider(new JasyptProperties("test-secret", null, null)));
    }

    private RoleEntity role;

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

    private CredentialEntity credential(PasswordManagerEntity pm, String username, Instant trashedAt) {
        CredentialEntity c = new CredentialEntity();
        c.setName(username);
        c.setUsername(username);
        c.setPassword("pw");
        c.setDeletedAt(trashedAt);
        c.setPasswordManager(pm);
        pm.getCredentials().add(c);
        em.persist(c);
        return c;
    }

    @Test
    void aCredentialIsFoundOnlyForItsOwner() {
        UserEntity me = user("me@x.com");
        UserEntity other = user("other@x.com");
        CredentialEntity mine = credential(group(me, "netflix.com"), "me", null);
        em.flush();
        em.clear();

        assertThat(credentials.findByIdAndPasswordManagerUserEntityUserId(mine.getId(), me.getUserId())).isPresent();
        assertThat(credentials.findByIdAndPasswordManagerUserEntityUserId(mine.getId(), other.getUserId())).isEmpty();
    }

    @Test
    void deletedAtRoundTripsAndNullMeansLive() {
        UserEntity me = user("me@x.com");
        PasswordManagerEntity pm = group(me, "netflix.com");
        CredentialEntity live = credential(pm, "live", null);
        CredentialEntity trashed = credential(pm, "trashed", NOW);
        em.flush();
        em.clear();

        assertThat(em.find(CredentialEntity.class, live.getId()).getDeletedAt()).isNull();
        assertThat(em.find(CredentialEntity.class, trashed.getId()).getDeletedAt()).isEqualTo(NOW);
    }

    @Test
    void thePurgeLookupReturnsOnlyEntriesTrashedBeforeTheCutoff() {
        UserEntity me = user("me@x.com");
        UserEntity other = user("other@x.com");
        CredentialEntity old = credential(group(me, "a.com"), "old", NOW.minus(Duration.ofDays(31)));
        CredentialEntity othersOld = credential(group(other, "b.com"), "theirs", NOW.minus(Duration.ofDays(45)));
        credential(group(me, "c.com"), "recent", NOW.minus(Duration.ofDays(29)));
        credential(group(me, "d.com"), "live", null);
        em.flush();
        em.clear();

        var expired = credentials.findAllByDeletedAtBefore(NOW.minus(Duration.ofDays(30)));

        assertThat(expired).extracting(CredentialEntity::getId).containsExactlyInAnyOrder(old.getId(), othersOld.getId());
    }

    @Test
    void theHubCountsOnlyGroupsThatStillHoldALiveEntry() {
        UserEntity me = user("me@x.com");
        UserEntity other = user("other@x.com");
        PasswordManagerEntity mixed = group(me, "netflix.com");
        credential(mixed, "live", null);
        credential(mixed, "live2", null);
        credential(mixed, "trashed", NOW);
        credential(group(me, "github.com"), "all-trashed", NOW);
        credential(group(other, "x.com"), "theirs", null);
        em.flush();
        em.clear();

        assertThat(groups.countByUserEntityUserId(me.getUserId())).isEqualTo(1);
    }

    @Test
    void aGroupIsFoundByIdOnlyForItsOwner() {
        UserEntity me = user("me@x.com");
        UserEntity other = user("other@x.com");
        PasswordManagerEntity pm = group(me, "netflix.com");
        em.flush();
        em.clear();

        assertThat(groups.findByIdAndUserEntityUserId(pm.getId(), me.getUserId())).isPresent();
        assertThat(groups.findByIdAndUserEntityUserId(pm.getId(), other.getUserId())).isEmpty();
    }
}
