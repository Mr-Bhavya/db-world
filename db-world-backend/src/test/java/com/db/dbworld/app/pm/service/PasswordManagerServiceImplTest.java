package com.db.dbworld.app.pm.service;

import com.db.dbworld.app.pm.dto.CredentialDto;
import com.db.dbworld.app.pm.dto.CustomFieldDto;
import com.db.dbworld.app.pm.entity.CredentialEntity;
import com.db.dbworld.app.pm.entity.CredentialType;
import com.db.dbworld.app.pm.entity.CustomFieldEntity;
import com.db.dbworld.app.pm.entity.CustomFieldType;
import com.db.dbworld.app.pm.entity.HostEntity;
import com.db.dbworld.app.pm.entity.PasswordManagerEntity;
import com.db.dbworld.app.pm.mapper.PasswordManagerMapper;
import com.db.dbworld.app.pm.mapper.PasswordManagerMapperImpl;
import com.db.dbworld.app.pm.repository.CredentialsRepository;
import com.db.dbworld.app.pm.repository.HostRepository;
import com.db.dbworld.app.pm.repository.PasswordManagerRepository;
import com.db.dbworld.app.pm.service.impl.PasswordManagerServiceImpl;
import com.db.dbworld.core.context.UserContext;
import com.db.dbworld.core.exception.DbWorldException;
import com.db.dbworld.core.user.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PasswordManagerServiceImplTest {

    @Mock private PasswordManagerRepository pmRepo;
    @Mock private HostRepository hostRepo;
    @Mock private CredentialsRepository credentialsRepo;
    @Mock private UserService userService;
    @Mock private UserContext userContext;

    private final PasswordManagerMapper mapper = new PasswordManagerMapperImpl();
    private PasswordManagerServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new PasswordManagerServiceImpl(pmRepo, hostRepo, credentialsRepo, userService, userContext, mapper);
        when(userContext.userId()).thenReturn(7L);
        when(hostRepo.findById(any())).thenReturn(Optional.empty());
        when(hostRepo.save(any(HostEntity.class))).thenAnswer(i -> i.getArgument(0));
        when(pmRepo.findAllByHostNameAndUserEntityUserId(any(), any())).thenReturn(List.of());
        when(pmRepo.findAllByUserEntityUserId(7L)).thenReturn(List.of());
    }

    private static CredentialDto dto(String name, String username, CredentialType type) {
        CredentialDto d = new CredentialDto();
        d.setName(name);
        d.setUsername(username);
        d.setType(type);
        return d;
    }

    private PasswordManagerEntity saved() {
        ArgumentCaptor<PasswordManagerEntity> c = ArgumentCaptor.forClass(PasswordManagerEntity.class);
        verify(pmRepo).save(c.capture());
        return c.getValue();
    }

    private static PasswordManagerEntity existing(String host, String name, String username) {
        PasswordManagerEntity pm = new PasswordManagerEntity();
        pm.setHost(host == null ? null : new HostEntity(host));
        CredentialEntity c = new CredentialEntity();
        c.setName(name);
        c.setUsername(username);
        pm.setCredentials(new ArrayList<>(List.of(c)));
        return pm;
    }

    @Test
    void anEntryWithNoWebsiteHasNoHostAndKeepsItsName() {
        service.addCredential(null, dto("db-world SSH", "dbworld_admin", null));

        PasswordManagerEntity pm = saved();
        assertThat(pm.getHost()).isNull();
        CredentialEntity c = pm.getCredentials().get(0);
        assertThat(c.getName()).isEqualTo("db-world SSH");
        assertThat(c.getType()).isEqualTo(CredentialType.LOGIN);
    }

    @Test
    void theNameDefaultsToTheHost() {
        service.addCredential("www.Netflix.com", dto("  ", "me@x.com", CredentialType.LOGIN));

        PasswordManagerEntity pm = saved();
        assertThat(pm.getHost().getName()).isEqualTo("netflix.com");
        assertThat(pm.getCredentials().get(0).getName()).isEqualTo("netflix.com");
    }

    @Test
    void aLoginNeedsAUsernameButANoteDoesNot() {
        assertThatThrownBy(() -> service.addCredential(null, dto("Box", " ", CredentialType.LOGIN)))
                .isInstanceOf(DbWorldException.class).hasMessageContaining("Username");

        service.addCredential(null, dto("Wi-Fi", null, CredentialType.NOTE));
        assertThat(saved().getCredentials()).hasSize(1);
    }

    @Test
    void noWebsiteAndNoNameIsRejected() {
        assertThatThrownBy(() -> service.addCredential(null, dto("", "u", CredentialType.LOGIN)))
                .isInstanceOf(DbWorldException.class).hasMessageContaining("Name");
    }

    @Test
    void theSameNameAndUsernameOnTheSameSiteIsADuplicateButAnotherAccountIsNot() {
        PasswordManagerEntity netflix = existing("netflix.com", "Netflix", "me@x.com");
        when(pmRepo.findAllByHostNameAndUserEntityUserId("netflix.com", 7L)).thenReturn(List.of(netflix));

        assertThatThrownBy(() -> service.addCredential("netflix.com", dto("netflix", "ME@x.com", null)))
                .isInstanceOf(DbWorldException.class).hasMessageContaining("already");

        service.addCredential("netflix.com", dto("Netflix", "other@x.com", null));
        assertThat(netflix.getCredentials()).hasSize(2);
    }

    @Test
    void entriesSavedBeforeNamesExistedCountAsNamedAfterTheirHost() {
        PasswordManagerEntity old = existing("github.com", null, "old");
        when(pmRepo.findAllByHostNameAndUserEntityUserId("github.com", 7L)).thenReturn(List.of(old));

        assertThatThrownBy(() -> service.addCredential("github.com", dto("", "old", null)))
                .isInstanceOf(DbWorldException.class);
    }

    @Test
    void siteLessEntriesAreComparedAmongThemselvesByNameAndUsername() {
        when(pmRepo.findAllByUserEntityUserId(7L)).thenReturn(List.of(
                existing("netflix.com", "Netflix", "dbworld_admin"),   // has a site: not a candidate
                existing(null, "db-world SSH", "dbworld_admin")));

        assertThatThrownBy(() -> service.addCredential(null, dto("DB-WORLD ssh", "dbworld_admin", null)))
                .isInstanceOf(DbWorldException.class);

        service.addCredential(null, dto("Netflix", "dbworld_admin", null)); // same name as a SITE entry: fine
    }

    // ── update ───────────────────────────────────────────────────────────────────

    private PasswordManagerEntity stored(String id, String host, String name, String username) {
        PasswordManagerEntity pm = existing(host, name, username);
        pm.setId("pm-" + id);
        pm.getCredentials().get(0).setId(id);
        when(pmRepo.findByIdAndUserEntityUserIdAndCredentialsId("pm-" + id, 7L, id)).thenReturn(Optional.of(pm));
        return pm;
    }

    private static CredentialDto edit(String id, String name, String username, String url) {
        CredentialDto d = dto(name, username, null);
        d.setId(id);
        d.setUrl(url);
        return d;
    }

    @Test
    void anUpdateWithoutAUrlLeavesTheEntryWhereItIs() {
        PasswordManagerEntity pm = stored("c1", "netflix.com", "Netflix", "me@x.com");

        service.updateCredential("pm-c1", edit("c1", "Netflix UK", "me@x.com", null));

        assertThat(pm.getCredentials().get(0).getName()).isEqualTo("Netflix UK");
        assertThat(pm.getHost().getName()).isEqualTo("netflix.com");
    }

    @Test
    void givingASiteMovesAnEntryOutOfItsSiteLessGroupAndDropsTheEmptyGroup() {
        PasswordManagerEntity old = stored("c1", null, "db-world SSH", "dbworld_admin");

        PasswordManagerDtoHolder r = new PasswordManagerDtoHolder(
                service.updateCredential("pm-c1", edit("c1", "db-world SSH", "dbworld_admin", "https://ssh.db-world.in")));

        assertThat(r.dto.getHost().getName()).isEqualTo("ssh.db-world.in");
        assertThat(old.getCredentials()).isEmpty();
        verify(pmRepo).delete(old);
    }

    @Test
    void blankUrlRemovesTheSite() {
        stored("c1", "github.com", "GitHub", "me");

        var r = service.updateCredential("pm-c1", edit("c1", "GitHub", "me", ""));

        assertThat(r.getHost()).isNull();
    }

    @Test
    void renamingOntoAnotherEntrysNameAndUsernameIsRejectedButKeepingYourOwnIsNot() {
        PasswordManagerEntity a = stored("c1", "netflix.com", "Netflix", "me@x.com");
        PasswordManagerEntity b = existing("netflix.com", "Netflix Kids", "me@x.com");
        b.getCredentials().get(0).setId("c2");
        when(pmRepo.findAllByHostNameAndUserEntityUserId("netflix.com", 7L)).thenReturn(List.of(a, b));

        assertThatThrownBy(() -> service.updateCredential("pm-c1", edit("c1", "Netflix Kids", "me@x.com", null)))
                .isInstanceOf(DbWorldException.class).hasMessageContaining("already");

        service.updateCredential("pm-c1", edit("c1", "Netflix", "me@x.com", null)); // itself: fine
    }

    private record PasswordManagerDtoHolder(com.db.dbworld.app.pm.dto.PasswordManagerDto dto) {}

    private static CustomFieldDto field(String key, String value, CustomFieldType type) {
        CustomFieldDto f = new CustomFieldDto();
        f.setFieldKey(key);
        f.setFieldValue(value);
        f.setFieldType(type);
        return f;
    }

    @Test
    void aCustomFieldWithoutATypeIsSavedAsHidden() {
        CredentialDto d = dto("db-world SSH", "dbworld_admin", CredentialType.LOGIN);
        d.setCustomFields(List.of(field("Token", "s3cret", null), field("Site", "https://x.io", CustomFieldType.URL)));

        service.addCredential(null, d);

        // The stored entity itself carries the type, not just the mapper's read default.
        var fields = saved().getCredentials().get(0).getCustomFields();
        assertThat(fields.get(0).getFieldType()).isEqualTo(CustomFieldType.HIDDEN);
        assertThat(fields.get(1).getFieldType()).isEqualTo(CustomFieldType.URL);
        assertThat(mapper.toDto(fields.get(0)).getFieldType()).isEqualTo(CustomFieldType.HIDDEN);
    }

    private static CustomFieldEntity storedField(String id, String key, String value, CustomFieldType type) {
        CustomFieldEntity f = new CustomFieldEntity(key, value, null);
        f.setId(id);
        f.setFieldType(type);
        return f;
    }

    @Test
    void anUpdateFromAnOlderClientKeepsTheTypeOfAFieldItSendsBack() {
        PasswordManagerEntity pm = stored("c1", "github.com", "GitHub", "me");
        pm.getCredentials().get(0).getCustomFields().add(storedField("f1", "Console", "https://x.io", CustomFieldType.URL));
        pm.getCredentials().get(0).getCustomFields().add(storedField("f2", "Key", "-----BEGIN-----", CustomFieldType.MULTILINE));
        CredentialDto d = edit("c1", "GitHub", "me", null);
        CustomFieldDto back1 = field("Console", "https://x.io", null);
        back1.setId("f1");
        CustomFieldDto back2 = field("Key", "-----BEGIN-----", null);
        back2.setId("f2");
        d.setCustomFields(List.of(back1, back2));

        service.updateCredential("pm-c1", d);

        var fields = pm.getCredentials().get(0).getCustomFields();
        assertThat(fields).extracting(CustomFieldEntity::getFieldKey).containsExactly("Console", "Key");
        assertThat(fields).extracting(CustomFieldEntity::getFieldType)
                .containsExactly(CustomFieldType.URL, CustomFieldType.MULTILINE);
    }

    @Test
    void anUpdatedFieldWithNoTypeAndNoStoredMatchIsHidden() {
        PasswordManagerEntity pm = stored("c1", "github.com", "GitHub", "me");
        pm.getCredentials().get(0).getCustomFields().add(storedField("f1", "Console", "https://x.io", CustomFieldType.URL));
        CredentialDto d = edit("c1", "GitHub", "me", null);
        CustomFieldDto unknown = field("New", "v", null);
        unknown.setId("not-stored");
        d.setCustomFields(List.of(unknown, field("Brand new", "v", null)));

        service.updateCredential("pm-c1", d);

        var fields = pm.getCredentials().get(0).getCustomFields();
        assertThat(fields).extracting(CustomFieldEntity::getFieldType)
                .containsExactly(CustomFieldType.HIDDEN, CustomFieldType.HIDDEN);
    }

    @Test
    void aStoredFieldWithNoTypeReadsAsHidden() {
        var old = new CustomFieldEntity("Old", "v", null);   // a row from before types existed

        assertThat(old.getFieldType()).isNull();
        assertThat(mapper.toDto(old).getFieldType()).isEqualTo(CustomFieldType.HIDDEN);
    }
}
