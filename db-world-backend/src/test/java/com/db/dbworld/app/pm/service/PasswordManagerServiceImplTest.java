package com.db.dbworld.app.pm.service;

import com.db.dbworld.app.pm.dto.CredentialDto;
import com.db.dbworld.app.pm.dto.CustomFieldDto;
import com.db.dbworld.app.pm.dto.PasswordHistoryDto;
import com.db.dbworld.app.pm.entity.CredentialEntity;
import com.db.dbworld.app.pm.entity.CredentialHistoryEntity;
import com.db.dbworld.app.pm.entity.CredentialType;
import com.db.dbworld.app.pm.entity.CustomFieldEntity;
import com.db.dbworld.app.pm.entity.CustomFieldType;
import com.db.dbworld.app.pm.entity.HostEntity;
import com.db.dbworld.app.pm.entity.PasswordManagerEntity;
import com.db.dbworld.app.pm.mapper.PasswordManagerMapper;
import com.db.dbworld.app.pm.mapper.PasswordManagerMapperImpl;
import com.db.dbworld.app.pm.repository.CredentialHistoryRepository;
import com.db.dbworld.app.pm.repository.CredentialsRepository;
import com.db.dbworld.app.pm.repository.HostRepository;
import com.db.dbworld.app.pm.repository.PasswordManagerRepository;
import com.db.dbworld.app.pm.service.impl.PasswordManagerServiceImpl;
import com.db.dbworld.app.pm.service.impl.TrashPurgeJob;
import com.db.dbworld.app.admin.scheduler.dto.JobRunSummary;
import com.db.dbworld.core.context.UserContext;
import com.db.dbworld.core.exception.DbWorldException;
import com.db.dbworld.core.exception.ResourceNotFoundException;
import com.db.dbworld.core.user.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Comparator;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PasswordManagerServiceImplTest {

    @Mock private PasswordManagerRepository pmRepo;
    @Mock private HostRepository hostRepo;
    @Mock private CredentialsRepository credentialsRepo;
    @Mock private CredentialHistoryRepository historyRepo;
    @Mock private UserService userService;
    @Mock private UserContext userContext;

    private static final Instant NOW = Instant.parse("2026-10-24T10:00:00Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);

    private final PasswordManagerMapper mapper = new PasswordManagerMapperImpl();
    private PasswordManagerServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new PasswordManagerServiceImpl(pmRepo, hostRepo, credentialsRepo, historyRepo, userService, userContext, mapper, CLOCK);
        fakeHistoryRepository();
        when(userContext.userId()).thenReturn(7L);
        when(hostRepo.findById(any())).thenReturn(Optional.empty());
        when(hostRepo.save(any(HostEntity.class))).thenAnswer(i -> i.getArgument(0));
        when(pmRepo.findAllByHostNameAndUserEntityUserId(any(), any())).thenReturn(List.of());
        when(pmRepo.findAllByUserEntityUserId(7L)).thenReturn(List.of());
    }

    /** What the history table holds. A new instance of this class per test, so it starts empty. */
    private final List<CredentialHistoryEntity> historyRows = new ArrayList<>();
    private final AtomicInteger historyIds = new AtomicInteger();

    /** Backs the mocked history repository with a list, so the service's inserts and trims show. */
    private void fakeHistoryRepository() {
        when(historyRepo.save(any(CredentialHistoryEntity.class))).thenAnswer(i -> {
            CredentialHistoryEntity h = i.getArgument(0);
            if (h.getId() == null) h.setId("h" + historyIds.incrementAndGet());
            if (!historyRows.contains(h)) historyRows.add(h);
            return h;
        });
        when(historyRepo.findAllByCredentialIdOrderByChangedAtDescIdDesc(any())).thenAnswer(i -> historyRows.stream()
                .filter(h -> h.getCredential().getId().equals(i.getArgument(0)))
                .sorted(Comparator.comparing(CredentialHistoryEntity::getChangedAt).reversed())
                .toList());
        when(historyRepo.findByIdAndCredentialId(any(), any())).thenAnswer(i -> historyRows.stream()
                .filter(h -> h.getId().equals(i.getArgument(0)) && h.getCredential().getId().equals(i.getArgument(1)))
                .findFirst());
        doAnswer(i -> historyRows.removeAll(i.<List<CredentialHistoryEntity>>getArgument(0)))
                .when(historyRepo).deleteAll(any());
        doAnswer(i -> historyRows.remove(i.<CredentialHistoryEntity>getArgument(0)))
                .when(historyRepo).delete(any(CredentialHistoryEntity.class));
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

    // ── trash ────────────────────────────────────────────────────────────────────

    /** A group with no credentials yet; fill it with addTo. */
    private static PasswordManagerEntity group(String id, String host) {
        PasswordManagerEntity pm = new PasswordManagerEntity();
        pm.setId(id);
        pm.setHost(host == null ? null : new HostEntity(host));
        pm.setCredentials(new ArrayList<>());
        return pm;
    }

    /** Adds a credential to the group, wired both ways, and makes the repo find it for user 7. */
    private CredentialEntity addTo(PasswordManagerEntity pm, String id, String name, String username, Instant trashedAt) {
        CredentialEntity c = new CredentialEntity();
        c.setId(id);
        c.setName(name);
        c.setUsername(username);
        c.setDeletedAt(trashedAt);
        c.setPasswordManager(pm);
        pm.getCredentials().add(c);
        when(credentialsRepo.findByIdAndPasswordManagerUserEntityUserId(id, 7L)).thenReturn(Optional.of(c));
        return c;
    }

    @Test
    void deleteMovesTheEntryToTrashInsteadOfRemovingIt() {
        PasswordManagerEntity pm = group("pm1", "netflix.com");
        CredentialEntity c = addTo(pm, "c1", "Netflix", "me@x.com", null);

        service.trashCredential("c1");

        assertThat(c.getDeletedAt()).isEqualTo(NOW);
        verify(credentialsRepo, never()).delete(any(CredentialEntity.class));
        verify(pmRepo, never()).delete(any(PasswordManagerEntity.class));
        assertThat(pm.getCredentials()).containsExactly(c);
    }

    @Test
    void trashingAnAlreadyTrashedEntryKeepsTheOriginalTime() {
        PasswordManagerEntity pm = group("pm1", "netflix.com");
        Instant earlier = NOW.minus(Duration.ofDays(3));
        CredentialEntity c = addTo(pm, "c1", "Netflix", "me@x.com", earlier);

        service.trashCredential("c1");

        assertThat(c.getDeletedAt()).isEqualTo(earlier);
    }

    @Test
    void anotherUsersEntryCannotBeTrashedRestoredOrPurged() {
        // The repo finds nothing for user 7: the id belongs to someone else (or to nobody).
        when(credentialsRepo.findByIdAndPasswordManagerUserEntityUserId("theirs", 7L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.trashCredential("theirs")).isInstanceOf(ResourceNotFoundException.class);
        assertThatThrownBy(() -> service.restore("theirs")).isInstanceOf(ResourceNotFoundException.class);
        assertThatThrownBy(() -> service.purge("theirs")).isInstanceOf(ResourceNotFoundException.class);
        assertThatThrownBy(() -> service.trashPasswordManager("their-pm")).isInstanceOf(ResourceNotFoundException.class);
        verify(credentialsRepo, never()).delete(any(CredentialEntity.class));
    }

    @Test
    void trashedEntriesAreNotInTheVaultList() {
        PasswordManagerEntity netflix = group("pm1", "netflix.com");
        addTo(netflix, "c1", "Netflix", "me@x.com", null);
        addTo(netflix, "c2", "Netflix Kids", "kids@x.com", NOW);
        PasswordManagerEntity github = group("pm2", "github.com");
        addTo(github, "c3", "GitHub", "me", NOW);          // every entry of this group is trashed
        when(pmRepo.findAllByUserEntityUserId(7L)).thenReturn(List.of(netflix, github));

        var vault = service.getPasswordManagerByUser();

        assertThat(vault).hasSize(1);
        assertThat(vault.get(0).getCredentials()).extracting(CredentialDto::getId).containsExactly("c1");
        // The group itself keeps both entries: the list is filtered, not the data.
        assertThat(netflix.getCredentials()).hasSize(2);
    }

    @Test
    void theTrashListHoldsOnlyTrashedEntriesAndSaysWhenTheyWereTrashed() {
        PasswordManagerEntity netflix = group("pm1", "netflix.com");
        addTo(netflix, "c1", "Netflix", "me@x.com", null);
        addTo(netflix, "c2", "Netflix Kids", "kids@x.com", NOW);
        PasswordManagerEntity box = group("pm2", null);
        addTo(box, "c3", "Box", "root", null);
        when(pmRepo.findAllByUserEntityUserId(7L)).thenReturn(List.of(netflix, box));

        var trash = service.listTrash();

        assertThat(trash).hasSize(1);
        assertThat(trash.get(0).getId()).isEqualTo("pm1");
        assertThat(trash.get(0).getCredentials()).extracting(CredentialDto::getId).containsExactly("c2");
        assertThat(trash.get(0).getCredentials().get(0).getDeletedAt()).isEqualTo(NOW);
    }

    @Test
    void aTrashedEntryDoesNotCountAsADuplicate() {
        PasswordManagerEntity netflix = group("pm1", "netflix.com");
        addTo(netflix, "c1", "Netflix", "me@x.com", NOW);
        when(pmRepo.findAllByHostNameAndUserEntityUserId("netflix.com", 7L)).thenReturn(List.of(netflix));

        service.addCredential("netflix.com", dto("Netflix", "me@x.com", null));

        assertThat(netflix.getCredentials()).hasSize(2);
    }

    @Test
    void anUpdateMayTakeTheNameOfATrashedEntry() {
        PasswordManagerEntity a = stored("c1", "netflix.com", "Netflix", "me@x.com");
        PasswordManagerEntity b = group("pm-c2", "netflix.com");
        addTo(b, "c2", "Netflix Kids", "me@x.com", NOW);
        when(pmRepo.findAllByHostNameAndUserEntityUserId("netflix.com", 7L)).thenReturn(List.of(a, b));

        service.updateCredential("pm-c1", edit("c1", "Netflix Kids", "me@x.com", null));

        assertThat(a.getCredentials().get(0).getName()).isEqualTo("Netflix Kids");
    }

    @Test
    void aTrashedEntryCannotBeUpdatedOrRead() {
        PasswordManagerEntity pm = stored("c1", "netflix.com", "Netflix", "me@x.com");
        CredentialEntity c = pm.getCredentials().get(0);
        c.setDeletedAt(NOW);
        c.setPasswordManager(pm);
        when(credentialsRepo.findByIdAndPasswordManagerUserEntityUserId("c1", 7L)).thenReturn(Optional.of(c));

        assertThatThrownBy(() -> service.updateCredential("pm-c1", edit("c1", "Renamed", "me@x.com", null)))
                .isInstanceOf(DbWorldException.class);
        assertThatThrownBy(() -> service.getCredentialById("c1")).isInstanceOf(ResourceNotFoundException.class);
        assertThat(c.getName()).isEqualTo("Netflix");
    }

    @Test
    void restoringOntoALiveDuplicateIsRefusedWith409() {
        PasswordManagerEntity netflix = group("pm1", "netflix.com");
        addTo(netflix, "live", "Netflix", "me@x.com", null);
        CredentialEntity trashed = addTo(netflix, "gone", "netflix", "ME@x.com", NOW);
        when(pmRepo.findAllByHostNameAndUserEntityUserId("netflix.com", 7L)).thenReturn(List.of(netflix));

        assertThatThrownBy(() -> service.restore("gone"))
                .isInstanceOfSatisfying(DbWorldException.class,
                        e -> assertThat(e.getHttpStatus()).isEqualTo(HttpStatus.CONFLICT))
                .hasMessageContaining("already");
        assertThat(trashed.getDeletedAt()).isEqualTo(NOW);   // still in Trash
    }

    @Test
    void restoringTakesTheEntryOutOfTrashWhenNothingLiveClashesWithIt() {
        PasswordManagerEntity netflix = group("pm1", "netflix.com");
        addTo(netflix, "live", "Netflix", "other@x.com", null);
        CredentialEntity trashed = addTo(netflix, "gone", "Netflix", "me@x.com", NOW);
        CredentialEntity alsoTrashed = addTo(netflix, "gone2", "Netflix", "me@x.com", NOW);   // another trashed copy
        when(pmRepo.findAllByHostNameAndUserEntityUserId("netflix.com", 7L)).thenReturn(List.of(netflix));

        service.restore("gone");

        assertThat(trashed.getDeletedAt()).isNull();
        assertThat(alsoTrashed.getDeletedAt()).isEqualTo(NOW);   // trashed entries do not clash
    }

    @Test
    void deletingASiteTrashesEveryCredentialOnIt() {
        PasswordManagerEntity pm = group("pm1", "netflix.com");
        CredentialEntity a = addTo(pm, "c1", "Netflix", "me@x.com", null);
        CredentialEntity b = addTo(pm, "c2", "Netflix Kids", "kids@x.com", null);
        Instant earlier = NOW.minus(Duration.ofDays(5));
        CredentialEntity old = addTo(pm, "c3", "Old", "old@x.com", earlier);
        when(pmRepo.findByIdAndUserEntityUserId("pm1", 7L)).thenReturn(Optional.of(pm));

        service.trashPasswordManager("pm1");

        assertThat(a.getDeletedAt()).isEqualTo(NOW);
        assertThat(b.getDeletedAt()).isEqualTo(NOW);
        assertThat(old.getDeletedAt()).isEqualTo(earlier);
        verify(pmRepo, never()).delete(any(PasswordManagerEntity.class));
    }

    @Test
    void purgeRemovesATrashedEntryAndItsGroupWhenItWasTheLastOne() {
        PasswordManagerEntity pm = group("pm1", "netflix.com");
        CredentialEntity gone = addTo(pm, "c1", "Netflix", "me@x.com", NOW);

        service.purge("c1");

        verify(credentialsRepo).delete(gone);
        verify(pmRepo).delete(pm);
        assertThat(pm.getCredentials()).isEmpty();
    }

    @Test
    void purgeKeepsTheGroupWhileItStillHoldsOtherEntries() {
        PasswordManagerEntity pm = group("pm1", "netflix.com");
        CredentialEntity gone = addTo(pm, "c1", "Netflix", "me@x.com", NOW);
        addTo(pm, "c2", "Netflix Kids", "kids@x.com", null);

        service.purge("c1");

        verify(credentialsRepo).delete(gone);
        verify(pmRepo, never()).delete(any(PasswordManagerEntity.class));
        assertThat(pm.getCredentials()).extracting(CredentialEntity::getId).containsExactly("c2");
    }

    @Test
    void aLiveEntryCannotBePurged() {
        PasswordManagerEntity pm = group("pm1", "netflix.com");
        addTo(pm, "c1", "Netflix", "me@x.com", null);

        assertThatThrownBy(() -> service.purge("c1")).isInstanceOf(ResourceNotFoundException.class);
        verify(credentialsRepo, never()).delete(any(CredentialEntity.class));
    }

    @Test
    void purgeJobRemovesEntriesTrashedMoreThan30DaysAgo() {
        PasswordManagerEntity pm = group("pm1", "netflix.com");
        CredentialEntity expired = addTo(pm, "c1", "Netflix", "me@x.com", NOW.minus(Duration.ofDays(31)));
        CredentialEntity recent = addTo(pm, "c2", "Netflix Kids", "kids@x.com", NOW.minus(Duration.ofDays(29)));
        PasswordManagerEntity github = group("pm2", "github.com");
        CredentialEntity expiredAlone = addTo(github, "c3", "GitHub", "me", NOW.minus(Duration.ofDays(60)));
        CredentialEntity live = addTo(group("pm3", "x.com"), "c4", "X", "me", null);
        List<CredentialEntity> all = List.of(expired, recent, expiredAlone, live);
        // What the database answers: entries trashed before the cutoff the job asks for.
        when(credentialsRepo.findAllByDeletedAtBefore(any(Instant.class))).thenAnswer(i -> {
            Instant cutoff = i.getArgument(0);
            return all.stream().filter(c -> c.getDeletedAt() != null && c.getDeletedAt().isBefore(cutoff)).toList();
        });
        var summary = JobRunSummary.builder();

        new TrashPurgeJob(service, CLOCK).purgeExpired(summary);

        verify(credentialsRepo).delete(expired);
        verify(credentialsRepo).delete(expiredAlone);
        verify(credentialsRepo, never()).delete(recent);
        verify(credentialsRepo, never()).delete(live);
        verify(pmRepo).delete(github);                          // its last entry went
        verify(pmRepo, never()).delete(pm);                     // "recent" still lives there
        assertThat(summary.build().counters()).containsEntry("entriesRemoved", 2L);
    }

    // ── password history ─────────────────────────────────────────────────────────

    /** A service whose clock moves one minute per reading, so history rows have distinct times. */
    private PasswordManagerServiceImpl serviceWithTickingClock() {
        AtomicInteger minute = new AtomicInteger();
        Clock ticking = new Clock() {
            @Override public ZoneOffset getZone() { return ZoneOffset.UTC; }
            @Override public Clock withZone(java.time.ZoneId zone) { return this; }
            @Override public Instant instant() { return NOW.plus(Duration.ofMinutes(minute.incrementAndGet())); }
        };
        return new PasswordManagerServiceImpl(pmRepo, hostRepo, credentialsRepo, historyRepo, userService, userContext, mapper, ticking);
    }

    /** An entry of user 7 that the update path and the history lookups both find, with this password. */
    private CredentialEntity entryWithPassword(String id, String password) {
        PasswordManagerEntity pm = stored(id, "netflix.com", "Netflix", "me@x.com");
        CredentialEntity c = pm.getCredentials().get(0);
        c.setPassword(password);
        c.setPasswordManager(pm);
        when(credentialsRepo.findByIdAndPasswordManagerUserEntityUserId(id, 7L)).thenReturn(Optional.of(c));
        return c;
    }

    private static CredentialDto editWithPassword(String id, String password) {
        CredentialDto d = edit(id, "Netflix", "me@x.com", null);
        d.setPassword(password);
        return d;
    }

    @Test
    void changingThePasswordKeepsTheOldOneInHistory() {
        CredentialEntity c = entryWithPassword("c1", "old-pw");

        service.updateCredential("pm-c1", editWithPassword("c1", "new-pw"));

        assertThat(c.getPassword()).isEqualTo("new-pw");
        List<PasswordHistoryDto> history = service.getHistory("c1");
        assertThat(history).extracting(PasswordHistoryDto::password).containsExactly("old-pw");
        assertThat(history.get(0).changedAt()).isEqualTo(NOW);
        assertThat(history.get(0).id()).isNotBlank();
    }

    @Test
    void historyKeepsOnlyTheLastFive() {
        PasswordManagerServiceImpl ticking = serviceWithTickingClock();
        entryWithPassword("c1", "pw0");

        for (int i = 1; i <= 7; i++) {
            ticking.updateCredential("pm-c1", editWithPassword("c1", "pw" + i));
        }

        // pw0..pw6 were replaced; the oldest two are gone, the rest come newest first.
        assertThat(ticking.getHistory("c1")).extracting(PasswordHistoryDto::password)
                .containsExactly("pw6", "pw5", "pw4", "pw3", "pw2");
        assertThat(historyRows).hasSize(5);
    }

    @Test
    void savingWithTheSamePasswordAddsNothing() {
        entryWithPassword("c1", "same-pw");

        service.updateCredential("pm-c1", editWithPassword("c1", "same-pw"));

        assertThat(service.getHistory("c1")).isEmpty();
        verify(historyRepo, never()).save(any(CredentialHistoryEntity.class));
    }

    @Test
    void settingTheFirstPasswordOfAnEntryAddsNoHistoryRow() {
        entryWithPassword("c1", null);

        service.updateCredential("pm-c1", editWithPassword("c1", "first-pw"));

        assertThat(historyRows).isEmpty();
    }

    @Test
    void clearingThePasswordKeepsTheOldOneInHistory() {
        CredentialEntity c = entryWithPassword("c1", "old-pw");

        service.updateCredential("pm-c1", editWithPassword("c1", ""));

        assertThat(c.getPassword()).isEmpty();
        assertThat(service.getHistory("c1")).extracting(PasswordHistoryDto::password).containsExactly("old-pw");
    }

    // ── null keeps, blank clears ─────────────────────────────────────────────────

    /** An entry holding a password, PIN and notes, found by the update path. */
    private CredentialEntity entryWithSecrets(String id) {
        CredentialEntity c = entryWithPassword(id, "stored-pw");
        c.setPin("1234");
        c.setNotes("stored notes");
        return c;
    }

    @Test
    void aMissingPasswordPinAndNotesKeepTheStoredValuesAndRecordNoHistory() {
        CredentialEntity c = entryWithSecrets("c1");
        CredentialDto d = edit("c1", "Netflix UK", "me@x.com", null);   // password, pin, notes all null

        service.updateCredential("pm-c1", d);

        assertThat(c.getName()).isEqualTo("Netflix UK");   // the rest of the edit still applies
        assertThat(c.getPassword()).isEqualTo("stored-pw");
        assertThat(c.getPin()).isEqualTo("1234");
        assertThat(c.getNotes()).isEqualTo("stored notes");
        assertThat(historyRows).isEmpty();
        verify(historyRepo, never()).save(any(CredentialHistoryEntity.class));
    }

    @Test
    void aBlankPasswordPinAndNotesClearTheStoredValuesAndOnlyThePasswordGoesToHistory() {
        CredentialEntity c = entryWithSecrets("c1");
        CredentialDto d = edit("c1", "Netflix", "me@x.com", null);
        d.setPassword("");
        d.setPin("");
        d.setNotes("");

        service.updateCredential("pm-c1", d);

        assertThat(c.getPassword()).isEmpty();
        assertThat(c.getPin()).isEmpty();
        assertThat(c.getNotes()).isEmpty();
        assertThat(historyRows).extracting(CredentialHistoryEntity::getPassword).containsExactly("stored-pw");
    }

    @Test
    void eachOfPasswordPinAndNotesIsKeptOrChangedOnItsOwn() {
        CredentialEntity c = entryWithSecrets("c1");
        CredentialDto d = edit("c1", "Netflix", "me@x.com", null);
        d.setPin("9999");   // only the PIN is sent

        service.updateCredential("pm-c1", d);

        assertThat(c.getPin()).isEqualTo("9999");
        assertThat(c.getPassword()).isEqualTo("stored-pw");
        assertThat(c.getNotes()).isEqualTo("stored notes");
        assertThat(historyRows).isEmpty();
    }

    @Test
    void restoringAnOldPasswordPutsItBackAndRecordsTheCurrentOne() {
        PasswordManagerServiceImpl ticking = serviceWithTickingClock();
        CredentialEntity c = entryWithPassword("c1", "pw0");
        ticking.updateCredential("pm-c1", editWithPassword("c1", "pw1"));   // history: pw0
        ticking.updateCredential("pm-c1", editWithPassword("c1", "pw2"));   // history: pw1, pw0
        String pw0Row = ticking.getHistory("c1").get(1).id();

        ticking.restorePassword("c1", pw0Row);

        assertThat(c.getPassword()).isEqualTo("pw0");
        // The restored row is used up; the password it replaced is now the newest row.
        assertThat(ticking.getHistory("c1")).extracting(PasswordHistoryDto::password).containsExactly("pw2", "pw1");

        // ...so the restore can itself be undone.
        ticking.restorePassword("c1", ticking.getHistory("c1").get(0).id());
        assertThat(c.getPassword()).isEqualTo("pw2");
        assertThat(ticking.getHistory("c1")).extracting(PasswordHistoryDto::password).containsExactly("pw0", "pw1");
    }

    @Test
    void historyOfAnotherUsersCredentialIs404() {
        // User 7's repo lookup finds nothing for an id that belongs to someone else.
        when(credentialsRepo.findByIdAndPasswordManagerUserEntityUserId("theirs", 7L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getHistory("theirs")).isInstanceOf(ResourceNotFoundException.class);
        assertThatThrownBy(() -> service.restorePassword("theirs", "h1")).isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void aHistoryRowOfAnotherEntryIs404AndChangesNothing() {
        CredentialEntity mine = entryWithPassword("c1", "mine-now");
        CredentialEntity other = entryWithPassword("c2", "other-now");
        CredentialHistoryEntity row = new CredentialHistoryEntity(other, "other-before", NOW);
        row.setId("h-other");
        historyRows.add(row);

        assertThatThrownBy(() -> service.restorePassword("c1", "h-other")).isInstanceOf(ResourceNotFoundException.class);
        assertThatThrownBy(() -> service.restorePassword("c1", "no-such-row")).isInstanceOf(ResourceNotFoundException.class);

        assertThat(mine.getPassword()).isEqualTo("mine-now");
        assertThat(historyRows).containsExactly(row);
    }

    @Test
    void aTrashedEntrysHistoryIsNotServedOrRestored() {
        CredentialEntity c = entryWithPassword("c1", "now");
        CredentialHistoryEntity row = new CredentialHistoryEntity(c, "before", NOW);
        row.setId("h1");
        historyRows.add(row);
        c.setDeletedAt(NOW);

        assertThatThrownBy(() -> service.getHistory("c1")).isInstanceOf(ResourceNotFoundException.class);
        assertThatThrownBy(() -> service.restorePassword("c1", "h1")).isInstanceOf(ResourceNotFoundException.class);
        assertThat(c.getPassword()).isEqualTo("now");
    }

    @Test
    void purgingAnEntryRemovesItsHistoryBeforeTheEntryItself() {
        PasswordManagerEntity pm = group("pm1", "netflix.com");
        CredentialEntity gone = addTo(pm, "c1", "Netflix", "me@x.com", NOW);

        service.purge("c1");

        var order = inOrder(historyRepo, credentialsRepo);
        order.verify(historyRepo).deleteByCredentialId("c1");
        order.verify(credentialsRepo).delete(gone);
    }

    // ── size limits ──────────────────────────────────────────────────────────────

    @Test
    void aNoteOver64KIsRejectedWithAClearMessage() {
        CredentialDto d = dto("Big note", null, CredentialType.NOTE);
        d.setNotes("x".repeat(65537));

        assertThatThrownBy(() -> service.addCredential(null, d))
                .isInstanceOfSatisfying(DbWorldException.class,
                        e -> assertThat(e.getHttpStatus()).isEqualTo(HttpStatus.BAD_REQUEST))
                .hasMessage("Notes is too long (max 65536)");
        verify(pmRepo, never()).save(any(PasswordManagerEntity.class));

        // exactly at the limit is fine
        d.setNotes("x".repeat(65536));
        service.addCredential(null, d);
        assertThat(saved().getCredentials()).hasSize(1);
    }

    @Test
    void aPasswordOver4096OrAPinOver128BytesIsRejectedOnAddAndNothingIsSaved() {
        CredentialDto longPassword = dto("Box", "root", CredentialType.LOGIN);
        longPassword.setPassword("p".repeat(4097));
        CredentialDto longPin = dto("Card", "me", CredentialType.LOGIN);
        longPin.setPin("1".repeat(129));

        assertThatThrownBy(() -> service.addCredential(null, longPassword))
                .isInstanceOf(DbWorldException.class).hasMessage("Password is too long (max 4096)");
        assertThatThrownBy(() -> service.addCredential(null, longPin))
                .isInstanceOf(DbWorldException.class).hasMessage("PIN is too long (max 128 bytes)");

        verify(pmRepo, never()).save(any(PasswordManagerEntity.class));
        verify(hostRepo, never()).save(any(HostEntity.class));
    }

    @Test
    void anUpdateOverTheLimitIsRejectedAndChangesNothing() {
        CredentialEntity c = entryWithPassword("c1", "old-pw");
        CredentialDto d = editWithPassword("c1", "p".repeat(4097));
        d.setName("Renamed");

        assertThatThrownBy(() -> service.updateCredential("pm-c1", d))
                .isInstanceOf(DbWorldException.class).hasMessage("Password is too long (max 4096)");

        assertThat(c.getPassword()).isEqualTo("old-pw");
        assertThat(c.getName()).isEqualTo("Netflix");
        assertThat(historyRows).isEmpty();
        verify(historyRepo, never()).save(any(CredentialHistoryEntity.class));
        verify(credentialsRepo, never()).save(any(CredentialEntity.class));

        // the same limits apply to notes and custom fields on update
        CredentialDto longNote = editWithPassword("c1", "ok");
        longNote.setNotes("n".repeat(65537));
        assertThatThrownBy(() -> service.updateCredential("pm-c1", longNote))
                .isInstanceOf(DbWorldException.class).hasMessage("Notes is too long (max 65536)");
        CredentialDto longField = editWithPassword("c1", "ok");
        longField.setCustomFields(List.of(field("ssh key", "k".repeat(65537), CustomFieldType.MULTILINE)));
        assertThatThrownBy(() -> service.updateCredential("pm-c1", longField))
                .isInstanceOf(DbWorldException.class).hasMessage("Custom field 'ssh key' is too long (max 65536)");
        assertThat(c.getPassword()).isEqualTo("old-pw");
        verify(credentialsRepo, never()).save(any(CredentialEntity.class));

        // Control: a valid update does reach that save, so the "never" above is not vacuous.
        service.updateCredential("pm-c1", editWithPassword("c1", "new-pw"));
        verify(credentialsRepo, times(1)).save(c);
        assertThat(c.getPassword()).isEqualTo("new-pw");
    }

    // ── column-sized limits ──────────────────────────────────────────────────────

    private static final String EMOJI = "😀";   // 4 bytes in UTF-8, 2 chars in Java

    private void assertRejectedOnAdd(CredentialDto d, String message) {
        assertThatThrownBy(() -> service.addCredential(null, d))
                .isInstanceOfSatisfying(DbWorldException.class,
                        e -> assertThat(e.getHttpStatus()).isEqualTo(HttpStatus.BAD_REQUEST))
                .hasMessage(message);
    }

    @Test
    void aPinIsLimitedTo128BytesExactlyAtTheLimitPassesAndOneOverIsRejected() {
        CredentialDto atLimit = dto("Card", "me", CredentialType.LOGIN);
        atLimit.setPin("1".repeat(128));
        service.addCredential(null, atLimit);
        assertThat(saved().getCredentials().get(0).getPin()).hasSize(128);

        CredentialDto over = dto("Card 2", "me", CredentialType.LOGIN);
        over.setPin("1".repeat(129));
        assertRejectedOnAdd(over, "PIN is too long (max 128 bytes)");
        verify(pmRepo, times(1)).save(any(PasswordManagerEntity.class));   // only the at-limit one
    }

    @Test
    void thePinLimitCountsBytesNotCharacters() {
        CredentialDto thirtyTwoEmoji = dto("Card", "me", CredentialType.LOGIN);
        thirtyTwoEmoji.setPin(EMOJI.repeat(32));            // 64 chars, exactly 128 bytes
        service.addCredential(null, thirtyTwoEmoji);
        assertThat(saved().getCredentials().get(0).getPin()).isEqualTo(EMOJI.repeat(32));

        CredentialDto thirtyThree = dto("Card 2", "me", CredentialType.LOGIN);
        thirtyThree.setPin(EMOJI.repeat(33));               // 66 chars (well under 128) but 132 bytes
        assertRejectedOnAdd(thirtyThree, "PIN is too long (max 128 bytes)");

        CredentialDto twoByte = dto("Card 3", "me", CredentialType.LOGIN);
        twoByte.setPin("é".repeat(65));                // 65 chars, 130 bytes
        assertRejectedOnAdd(twoByte, "PIN is too long (max 128 bytes)");
    }

    @Test
    void aNameIsLimitedTo320BytesExactlyAtTheLimitPassesAndOneOverIsRejected() {
        service.addCredential(null, dto("n".repeat(320), "me", CredentialType.LOGIN));
        assertThat(saved().getCredentials().get(0).getName()).hasSize(320);

        assertRejectedOnAdd(dto("n".repeat(321), "me", CredentialType.LOGIN), "Name is too long (max 320 bytes)");
        // 80 emoji are 160 chars but exactly 320 bytes; one more is over
        assertRejectedOnAdd(dto(EMOJI.repeat(81), "me", CredentialType.LOGIN), "Name is too long (max 320 bytes)");
        verify(pmRepo, times(1)).save(any(PasswordManagerEntity.class));
    }

    @Test
    void aNameOfEightyEmojiIsAcceptedBecauseItIsExactly320Bytes() {
        service.addCredential(null, dto(EMOJI.repeat(80), "me", CredentialType.LOGIN));

        assertThat(saved().getCredentials().get(0).getName()).isEqualTo(EMOJI.repeat(80));
    }

    @Test
    void aUsernameIsLimitedTo320BytesExactlyAtTheLimitPassesAndOneOverIsRejected() {
        service.addCredential(null, dto("Box", "u".repeat(320), CredentialType.LOGIN));
        assertThat(saved().getCredentials().get(0).getUsername()).hasSize(320);

        assertRejectedOnAdd(dto("Box 2", "u".repeat(321), CredentialType.LOGIN), "Username is too long (max 320 bytes)");
        assertRejectedOnAdd(dto("Box 3", EMOJI.repeat(81), CredentialType.LOGIN), "Username is too long (max 320 bytes)");
        verify(pmRepo, times(1)).save(any(PasswordManagerEntity.class));
    }

    @Test
    void theColumnSizedLimitsApplyToAnUpdateToo() {
        CredentialEntity c = entryWithPassword("c1", "old-pw");
        c.setPin("1234");
        CredentialDto longPin = edit("c1", "Netflix", "me@x.com", null);
        longPin.setPin("1".repeat(129));
        CredentialDto longName = edit("c1", "n".repeat(321), "me@x.com", null);
        CredentialDto longUsername = edit("c1", "Netflix", "u".repeat(321), null);
        CredentialDto longKey = edit("c1", "Netflix", "me@x.com", null);
        longKey.setCustomFields(List.of(field("k".repeat(256), "v", CustomFieldType.TEXT)));

        assertThatThrownBy(() -> service.updateCredential("pm-c1", longPin)).hasMessage("PIN is too long (max 128 bytes)");
        assertThatThrownBy(() -> service.updateCredential("pm-c1", longName)).hasMessage("Name is too long (max 320 bytes)");
        assertThatThrownBy(() -> service.updateCredential("pm-c1", longUsername)).hasMessage("Username is too long (max 320 bytes)");
        assertThatThrownBy(() -> service.updateCredential("pm-c1", longKey)).hasMessage("Custom field name is too long (max 255)");

        assertThat(c.getPin()).isEqualTo("1234");
        assertThat(c.getName()).isEqualTo("Netflix");
        assertThat(c.getUsername()).isEqualTo("me@x.com");
        verify(credentialsRepo, never()).save(any(CredentialEntity.class));
    }

    @Test
    void aCustomFieldNameIsLimitedTo255CharactersAndMustNotBeNull() {
        CredentialDto atLimit = dto("Box", "root", CredentialType.LOGIN);
        atLimit.setCustomFields(List.of(field("k".repeat(255), "v", CustomFieldType.TEXT)));
        service.addCredential(null, atLimit);
        assertThat(saved().getCredentials().get(0).getCustomFields().get(0).getFieldKey()).hasSize(255);

        CredentialDto over = dto("Box 2", "root", CredentialType.LOGIN);
        over.setCustomFields(List.of(field("SECRETLABEL" + "k".repeat(250), "v", CustomFieldType.TEXT)));
        assertThatThrownBy(() -> service.addCredential(null, over))
                .isInstanceOfSatisfying(DbWorldException.class,
                        e -> assertThat(e.getHttpStatus()).isEqualTo(HttpStatus.BAD_REQUEST))
                .hasMessage("Custom field name is too long (max 255)")
                .hasMessageNotContaining("SECRETLABEL");

        CredentialDto noKey = dto("Box 3", "root", CredentialType.LOGIN);
        noKey.setCustomFields(List.of(field(null, "v", CustomFieldType.TEXT)));
        assertRejectedOnAdd(noKey, "Custom field name is required");
        verify(pmRepo, times(1)).save(any(PasswordManagerEntity.class));   // only the at-limit one
    }

    @Test
    void aPasswordOfExactly4096CharactersAndACustomFieldValueOfExactly65536AreAccepted() {
        CredentialDto d = dto("Box", "root", CredentialType.LOGIN);
        d.setPassword("p".repeat(4096));
        d.setCustomFields(List.of(field("ssh key", "k".repeat(65536), CustomFieldType.MULTILINE)));

        service.addCredential(null, d);

        var c = saved().getCredentials().get(0);
        assertThat(c.getPassword()).hasSize(4096);
        assertThat(c.getCustomFields().get(0).getFieldValue()).hasSize(65536);
    }

    @Test
    void aLongFieldKeyIsTruncatedInTheErrorAndTheValueIsNeverEchoed() {
        CredentialDto d = dto("Box", "root", CredentialType.LOGIN);
        d.setCustomFields(List.of(field("k".repeat(100), "SECRETVALUE" + "v".repeat(65537), CustomFieldType.MULTILINE)));

        assertThatThrownBy(() -> service.addCredential(null, d))
                .isInstanceOf(DbWorldException.class)
                .hasMessage("Custom field '" + "k".repeat(60) + "...' is too long (max 65536)")
                .hasMessageNotContaining("k".repeat(61))
                .hasMessageNotContaining("SECRETVALUE");
    }

    @Test
    void thirtyOneCustomFieldsAreRejected() {
        List<CustomFieldDto> thirty = new ArrayList<>();
        for (int i = 1; i <= 30; i++) thirty.add(field("k" + i, "v", CustomFieldType.TEXT));
        CredentialDto ok = dto("Thirty", "me", CredentialType.LOGIN);
        ok.setCustomFields(thirty);
        service.addCredential(null, ok);                       // 30 is the limit: fine
        assertThat(saved().getCredentials().get(0).getCustomFields()).hasSize(30);

        List<CustomFieldDto> thirtyOne = new ArrayList<>(thirty);
        thirtyOne.add(field("k31", "v", CustomFieldType.TEXT));
        CredentialDto tooMany = dto("Thirty-one", "me", CredentialType.LOGIN);
        tooMany.setCustomFields(thirtyOne);

        assertThatThrownBy(() -> service.addCredential(null, tooMany))
                .isInstanceOfSatisfying(DbWorldException.class,
                        e -> assertThat(e.getHttpStatus()).isEqualTo(HttpStatus.BAD_REQUEST))
                .hasMessage("Too many custom fields (max 30)");
        verify(pmRepo, times(1)).save(any(PasswordManagerEntity.class));   // only the 30-field one
    }

    @Test
    void aCustomFieldValueOver64KIsRejectedNamingTheFieldButNotItsValue() {
        CredentialDto d = dto("Box", "root", CredentialType.LOGIN);
        d.setCustomFields(List.of(field("ssh key", "SECRETVALUE" + "k".repeat(65537), CustomFieldType.MULTILINE)));

        assertThatThrownBy(() -> service.addCredential(null, d))
                .isInstanceOf(DbWorldException.class)
                .hasMessage("Custom field 'ssh key' is too long (max 65536)")
                .hasMessageNotContaining("SECRETVALUE");
        verify(pmRepo, never()).save(any(PasswordManagerEntity.class));
    }

    @Test
    void a3KBPrivateKeyInACustomFieldIsAccepted() {
        // The case that started this work: an OpenSSH private key is a few KB, far past the old 255-char column.
        String privateKey = "-----BEGIN OPENSSH PRIVATE KEY-----\n" + "A".repeat(3000) + "\n-----END OPENSSH PRIVATE KEY-----";
        CredentialDto d = dto("db-world SSH", "dbworld_admin", CredentialType.LOGIN);
        d.setCustomFields(List.of(field("private key", privateKey, CustomFieldType.MULTILINE)));

        service.addCredential(null, d);

        var fields = saved().getCredentials().get(0).getCustomFields();
        assertThat(fields).hasSize(1);
        assertThat(fields.get(0).getFieldValue()).isEqualTo(privateKey);
    }

    @Test
    void theDailyPurgeRemovesTheHistoryOfEveryEntryItRemoves() {
        PasswordManagerEntity pm = group("pm1", "netflix.com");
        addTo(pm, "c1", "Netflix", "me@x.com", NOW.minus(Duration.ofDays(31)));
        addTo(pm, "c2", "Netflix Kids", "kids@x.com", NOW.minus(Duration.ofDays(40)));
        when(credentialsRepo.findAllByDeletedAtBefore(any(Instant.class))).thenReturn(List.copyOf(pm.getCredentials()));

        service.purgeTrashedBefore(NOW.minus(Duration.ofDays(30)));

        verify(historyRepo).deleteByCredentialId("c1");
        verify(historyRepo).deleteByCredentialId("c2");
        verify(historyRepo, times(2)).deleteByCredentialId(any());
    }
}
