package com.db.dbworld.app.pm.service;

import com.db.dbworld.app.pm.dto.CredentialDto;
import com.db.dbworld.app.pm.entity.CredentialEntity;
import com.db.dbworld.app.pm.entity.CredentialType;
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
}
