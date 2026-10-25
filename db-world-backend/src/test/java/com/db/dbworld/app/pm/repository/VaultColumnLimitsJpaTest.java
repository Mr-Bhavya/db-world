package com.db.dbworld.app.pm.repository;

import com.db.dbworld.app.pm.entity.CredentialEntity;
import com.db.dbworld.app.pm.entity.CustomFieldEntity;
import com.db.dbworld.app.pm.entity.HostEntity;
import com.db.dbworld.app.pm.entity.PasswordManagerEntity;
import com.db.dbworld.app.pm.service.impl.PasswordManagerServiceImpl;
import com.db.dbworld.config.JasyptProperties;
import com.db.dbworld.core.role.entity.RoleEntity;
import com.db.dbworld.core.role.enums.Role;
import com.db.dbworld.core.user.entity.UserEntity;
import com.db.dbworld.security.crypto.CryptoProvider;
import com.db.dbworld.security.crypto.StringCryptoConverter;
import jakarta.persistence.Column;
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

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Proves the size limits of the vault against the real columns. The limits in the service are in
 * plaintext bytes, the columns hold ciphertext, so the numbers only mean something if a value of
 * exactly the limit still fits once encrypted. Two checks: the real {@link CryptoProvider} against the
 * {@code length} on each column annotation, and a save of limit-sized values on H2, which enforces
 * VARCHAR lengths like MySQL does.
 */
@DataJpaTest
@ActiveProfiles("test")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@DisplayName("Vault column limits")
class VaultColumnLimitsJpaTest {

    @TestConfiguration
    static class CacheStubConfig {
        @Bean
        CacheManager cacheManager() {
            return new NoOpCacheManager();
        }
    }

    /** 4 bytes in UTF-8: the worst case per character. */
    private static final String EMOJI = "😀";

    @Autowired private EntityManager em;

    private CryptoProvider crypto;

    @BeforeEach
    void cryptoForTheConverter() {
        crypto = new CryptoProvider(new JasyptProperties("test-secret", null, null));
        StringCryptoConverter.setCryptoProvider(crypto);
    }

    private static int columnLength(Class<?> entity, String field) throws NoSuchFieldException {
        return entity.getDeclaredField(field).getAnnotation(Column.class).length();
    }

    /** A string of exactly this many UTF-8 bytes: as many of the unit as fit, then ASCII to fill the rest. */
    private static String ofBytes(String unit, int bytes) {
        int unitBytes = unit.getBytes(StandardCharsets.UTF_8).length;
        return unit.repeat(bytes / unitBytes) + "a".repeat(bytes % unitBytes);
    }

    private void assertCiphertextFits(String plaintext, int expectedBytes, int column) {
        assertThat(plaintext.getBytes(StandardCharsets.UTF_8)).hasSize(expectedBytes);
        String cipher = crypto.encrypt(plaintext);
        assertThat(cipher).startsWith("AES:");
        assertThat(cipher.length()).as("ciphertext of %d bytes", expectedBytes).isLessThanOrEqualTo(column);
    }

    @Test
    void theColumnLengthsAreWhatTheLimitsWereMeasuredAgainst() throws NoSuchFieldException {
        assertThat(columnLength(CredentialEntity.class, "pin")).isEqualTo(255);
        assertThat(columnLength(CredentialEntity.class, "name")).isEqualTo(512);
        assertThat(columnLength(CredentialEntity.class, "username")).isEqualTo(512);
        assertThat(columnLength(CustomFieldEntity.class, "fieldKey")).isEqualTo(255);
    }

    @Test
    void aPinOfTheLimitSizeEncryptsToLessThanItsColumnForEveryCharacterWidth() throws NoSuchFieldException {
        int column = columnLength(CredentialEntity.class, "pin");
        for (String unit : new String[]{"1", "é", "€", EMOJI}) {
            assertCiphertextFits(ofBytes(unit, PasswordManagerServiceImpl.MAX_PIN_BYTES),
                    PasswordManagerServiceImpl.MAX_PIN_BYTES, column);
        }
    }

    @Test
    void aNameAndAUsernameOfTheLimitSizeEncryptToLessThanTheirColumnsForEveryCharacterWidth() throws NoSuchFieldException {
        int nameColumn = columnLength(CredentialEntity.class, "name");
        int usernameColumn = columnLength(CredentialEntity.class, "username");
        for (String unit : new String[]{"n", "é", "€", EMOJI}) {
            assertCiphertextFits(ofBytes(unit, PasswordManagerServiceImpl.MAX_NAME_BYTES),
                    PasswordManagerServiceImpl.MAX_NAME_BYTES, nameColumn);
            assertCiphertextFits(ofBytes(unit, PasswordManagerServiceImpl.MAX_USERNAME_BYTES),
                    PasswordManagerServiceImpl.MAX_USERNAME_BYTES, usernameColumn);
        }
    }

    @Test
    void theLimitsLeaveRoomButNotTooMuchOfIt() throws NoSuchFieldException {
        // One cipher block (16 bytes) more than the limit must already not fit, or the limit is
        // needlessly low; the limit itself must fit with room to spare.
        int pinColumn = columnLength(CredentialEntity.class, "pin");
        int nameColumn = columnLength(CredentialEntity.class, "name");
        assertThat(crypto.encrypt("1".repeat(PasswordManagerServiceImpl.MAX_PIN_BYTES + 16)).length())
                .isGreaterThan(pinColumn);
        assertThat(crypto.encrypt("n".repeat(PasswordManagerServiceImpl.MAX_NAME_BYTES + 16)).length())
                .isGreaterThan(nameColumn);
        assertThat(crypto.encrypt("1".repeat(PasswordManagerServiceImpl.MAX_PIN_BYTES)).length())
                .isLessThanOrEqualTo(pinColumn - 10);
        assertThat(crypto.encrypt("n".repeat(PasswordManagerServiceImpl.MAX_NAME_BYTES)).length())
                .isLessThanOrEqualTo(nameColumn - 10);
    }

    @Test
    void anEntryWithLimitSizedValuesIsSavedOnH2AndAFieldKeyOf255CharactersToo() {
        RoleEntity role = new RoleEntity();
        role.setName(Role.VIEWER);
        em.persist(role);
        UserEntity owner = new UserEntity();
        owner.setEmail("me@x.com");
        owner.setRole(role);
        em.persist(owner);
        HostEntity host = new HostEntity("netflix.com");
        em.persist(host);
        PasswordManagerEntity pm = new PasswordManagerEntity();
        pm.setHost(host);
        pm.setUserEntity(owner);
        pm.setCredentials(new ArrayList<>());
        em.persist(pm);

        CredentialEntity c = new CredentialEntity();
        c.setPasswordManager(pm);
        c.setName(EMOJI.repeat(PasswordManagerServiceImpl.MAX_NAME_BYTES / 4));
        c.setUsername(EMOJI.repeat(PasswordManagerServiceImpl.MAX_USERNAME_BYTES / 4));
        c.setPin(EMOJI.repeat(PasswordManagerServiceImpl.MAX_PIN_BYTES / 4));
        pm.getCredentials().add(c);
        em.persist(c);
        CustomFieldEntity field = new CustomFieldEntity("k".repeat(PasswordManagerServiceImpl.MAX_FIELD_KEY_CHARS), "v", c);
        c.getCustomFields().add(field);
        em.persist(field);

        em.flush();   // H2 refuses a value longer than its VARCHAR column: this would throw
        em.clear();

        CredentialEntity back = em.find(CredentialEntity.class, c.getId());
        assertThat(back.getPin()).isEqualTo(EMOJI.repeat(PasswordManagerServiceImpl.MAX_PIN_BYTES / 4));
        assertThat(back.getName()).isEqualTo(EMOJI.repeat(PasswordManagerServiceImpl.MAX_NAME_BYTES / 4));
        assertThat(back.getUsername()).isEqualTo(EMOJI.repeat(PasswordManagerServiceImpl.MAX_USERNAME_BYTES / 4));
        assertThat(back.getCustomFields()).singleElement()
                .satisfies(f -> assertThat(f.getFieldKey()).hasSize(255));
    }

    @Test
    void h2RefusesAPinOneBlockOverTheLimitSoTheSaveAboveProvesSomething() {
        // The control for the test above: without it, "the save worked" could just mean H2 ignores lengths.
        RoleEntity role = new RoleEntity();
        role.setName(Role.VIEWER);
        em.persist(role);
        UserEntity owner = new UserEntity();
        owner.setEmail("me@x.com");
        owner.setRole(role);
        em.persist(owner);
        PasswordManagerEntity pm = new PasswordManagerEntity();
        pm.setUserEntity(owner);
        pm.setCredentials(new ArrayList<>());
        em.persist(pm);
        CredentialEntity c = new CredentialEntity();
        c.setPasswordManager(pm);
        c.setPin("1".repeat(PasswordManagerServiceImpl.MAX_PIN_BYTES + 32));   // 160 bytes -> 284 chars of ciphertext
        em.persist(c);

        assertThatThrownBy(() -> em.flush()).rootCause().hasMessageContaining("too long");
    }
}
