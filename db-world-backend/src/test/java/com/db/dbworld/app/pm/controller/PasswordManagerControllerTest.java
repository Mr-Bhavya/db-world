package com.db.dbworld.app.pm.controller;

import com.db.dbworld.app.pm.entity.CredentialEntity;
import com.db.dbworld.app.pm.entity.CredentialHistoryEntity;
import com.db.dbworld.app.pm.entity.CustomFieldEntity;
import com.db.dbworld.app.pm.entity.CustomFieldType;
import com.db.dbworld.app.pm.entity.HostEntity;
import com.db.dbworld.app.pm.entity.PasswordManagerEntity;
import com.db.dbworld.app.pm.mapper.CredentialMapperImpl;
import com.db.dbworld.app.pm.mapper.PasswordManagerMapperImpl;
import com.db.dbworld.app.pm.repository.CredentialHistoryRepository;
import com.db.dbworld.app.pm.repository.CredentialsRepository;
import com.db.dbworld.app.pm.repository.HostRepository;
import com.db.dbworld.app.pm.repository.PasswordManagerRepository;
import com.db.dbworld.app.pm.service.PasswordManagerService;
import com.db.dbworld.app.pm.service.SecretReadRateLimiter;
import com.db.dbworld.app.pm.service.impl.PasswordManagerServiceImpl;
import com.db.dbworld.config.AppConstants;
import com.db.dbworld.core.context.UserContext;
import com.db.dbworld.core.exception.GlobalExceptionHandler;
import com.db.dbworld.core.user.service.UserService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.http.server.PathContainer;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.test.context.junit.jupiter.web.SpringJUnitWebConfig;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;
import org.springframework.web.util.pattern.PathPatternParser;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The vault endpoints as a client sees them: the real controller, service, mapper, JSON and
 * exception handler, with {@code @AnyRole} enforced by Spring's method security. Only the
 * repositories are mocks. The JWT filter chain is not in play: the test puts the signed-in user (or
 * an anonymous one, which is what that chain leaves for a request without a token) in the security
 * context itself.
 */
@SpringJUnitWebConfig(PasswordManagerControllerTest.Config.class)
class PasswordManagerControllerTest {

    private static final Instant NOW = Instant.parse("2026-10-25T10:00:00Z");

    private static final PasswordManagerRepository GROUPS = mock(PasswordManagerRepository.class);
    private static final CredentialsRepository CREDENTIALS = mock(CredentialsRepository.class);
    private static final CredentialHistoryRepository HISTORY = mock(CredentialHistoryRepository.class);

    @Configuration
    @EnableWebMvc
    @EnableMethodSecurity
    static class Config {
        @Bean
        UserContext userContext() {
            return new UserContext();
        }

        @Bean
        PasswordManagerService passwordManagerService(UserContext userContext) {
            Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);
            return new PasswordManagerServiceImpl(GROUPS, mock(HostRepository.class), CREDENTIALS, HISTORY,
                    mock(UserService.class), userContext, new PasswordManagerMapperImpl(), clock,
                    new SecretReadRateLimiter(clock));
        }

        @Bean
        PasswordManagerController passwordManagerController(PasswordManagerService service) {
            return new PasswordManagerController(service, new CredentialMapperImpl());
        }

        @Bean
        GlobalExceptionHandler globalExceptionHandler() {
            return new GlobalExceptionHandler();
        }
    }

    @Autowired
    private WebApplicationContext context;

    private MockMvc mvc;

    // What user 7 keeps in the vault. None of these may ever appear in the list.
    private static final List<String> SECRETS = List.of(
            "pw-Netflix-9f3e", "pin-4821", "notes-about-the-account", "hidden-recovery-code", "multi-line-private-key",
            "pw-in-trash-77ab", "old-password-in-history");

    @BeforeEach
    void setUp() {
        reset(GROUPS, CREDENTIALS, HISTORY);
        mvc = MockMvcBuilders.webAppContextSetup(context).build();
        signInAs(7L, "VIEWER");

        PasswordManagerEntity netflix = group("pm1", "netflix.com");
        CredentialEntity c1 = credential(netflix, "c1", "Netflix", "me@x.com", null);
        c1.setPassword("pw-Netflix-9f3e");
        c1.setPin("pin-4821");
        c1.setNotes("notes-about-the-account");
        field(c1, "f1", "Recovery", "hidden-recovery-code", CustomFieldType.HIDDEN);
        field(c1, "f2", "Key", "multi-line-private-key", CustomFieldType.MULTILINE);
        field(c1, "f3", "Account no", "acct-1234", CustomFieldType.TEXT);
        CredentialEntity trashed = credential(netflix, "c2", "Netflix old", "old@x.com", NOW);
        trashed.setPassword("pw-in-trash-77ab");
        when(GROUPS.findAllByUserEntityUserId(7L)).thenReturn(List.of(netflix));

        CredentialHistoryEntity row = new CredentialHistoryEntity(c1, "old-password-in-history", NOW);
        row.setId("h1");
        when(HISTORY.findByIdAndCredentialId("h1", "c1")).thenReturn(Optional.of(row));
        when(HISTORY.findAllByCredentialIdOrderByChangedAtDescIdDesc("c1")).thenReturn(List.of(row));

        // Another user's entry: user 7's lookup never finds it.
        when(CREDENTIALS.findByIdAndPasswordManagerUserEntityUserId("theirs", 7L)).thenReturn(Optional.empty());
    }

    @AfterEach
    void signOut() {
        SecurityContextHolder.clearContext();
    }

    private static void signInAs(long userId, String role) {
        Jwt jwt = Jwt.withTokenValue("token").header("alg", "RS256").claim("userId", userId).claim("role", role).build();
        SecurityContextHolder.getContext().setAuthentication(
                new JwtAuthenticationToken(jwt, AuthorityUtils.createAuthorityList(role)));
    }

    private static PasswordManagerEntity group(String id, String host) {
        PasswordManagerEntity pm = new PasswordManagerEntity();
        pm.setId(id);
        pm.setHost(new HostEntity(host));
        pm.setCredentials(new ArrayList<>());
        return pm;
    }

    private static CredentialEntity credential(PasswordManagerEntity pm, String id, String name, String username, Instant trashedAt) {
        CredentialEntity c = new CredentialEntity();
        c.setId(id);
        c.setName(name);
        c.setUsername(username);
        c.setDeletedAt(trashedAt);
        c.setPasswordManager(pm);
        pm.getCredentials().add(c);
        when(CREDENTIALS.findByIdAndPasswordManagerUserEntityUserId(id, 7L)).thenReturn(Optional.of(c));
        return c;
    }

    private static void field(CredentialEntity c, String id, String key, String value, CustomFieldType type) {
        CustomFieldEntity f = new CustomFieldEntity(key, value, c);
        f.setId(id);
        f.setFieldType(type);
        c.getCustomFields().add(f);
    }

    @Test
    void listNeverContainsPasswordPinNotesOrHiddenValues() throws Exception {
        String vault = mvc.perform(get("/api/pm/")).andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].host").value("netflix.com"))
                .andExpect(jsonPath("$.data[0].credentials[0].id").value("c1"))
                .andExpect(jsonPath("$.data[0].credentials[0].hasPassword").value(true))
                .andExpect(jsonPath("$.data[0].credentials[0].hasPin").value(true))
                .andExpect(jsonPath("$.data[0].credentials[0].hasNotes").value(true))
                .andExpect(jsonPath("$.data[0].credentials[0].customFields[2].fieldValue").value("acct-1234"))
                .andReturn().getResponse().getContentAsString();
        String trash = mvc.perform(get("/api/pm/trash")).andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].credentials[0].id").value("c2"))
                .andReturn().getResponse().getContentAsString();

        for (String body : List.of(vault, trash)) {
            assertThat(SECRETS).allSatisfy(secret -> assertThat(body).doesNotContain(secret));
            assertThat(body).doesNotContain("\"password\"").doesNotContain("\"pin\"").doesNotContain("\"notes\"");
        }
    }

    @Test
    void anEditAnswersWithoutAnyOfTheEntrysSecrets() throws Exception {
        PasswordManagerEntity netflix = GROUPS.findAllByUserEntityUserId(7L).getFirst();
        when(GROUPS.findByIdAndUserEntityUserIdAndCredentialsId("pm1", 7L, "c1")).thenReturn(Optional.of(netflix));

        // Password, PIN and notes left out ("keep what is stored"); the hidden fields sent back as the edit dialog does.
        String body = mvc.perform(put("/api/pm/pm1").contentType(MediaType.APPLICATION_JSON).content("""
                        {"id": "c1", "name": "Netflix UK", "username": "me@x.com",
                         "customFields": [
                           {"id": "f1", "fieldKey": "Recovery", "fieldValue": "hidden-recovery-code", "fieldType": "HIDDEN"},
                           {"id": "f2", "fieldKey": "Key", "fieldValue": "multi-line-private-key", "fieldType": "MULTILINE"}]}
                        """))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        assertThat(netflix.getCredentials().getFirst().getName()).isEqualTo("Netflix UK");   // the edit was saved
        assertThat(netflix.getCredentials().getFirst().getPassword()).isEqualTo("pw-Netflix-9f3e");   // and kept the password
        assertThat(SECRETS).allSatisfy(secret -> assertThat(body).doesNotContain(secret));
        assertThat(body).doesNotContain("\"password\"").doesNotContain("\"pin\"").doesNotContain("\"notes\"")
                .doesNotContain("\"fieldValue\"");
    }

    @Test
    void revealReturnsTheSecretForTheOwner() throws Exception {
        mvc.perform(get("/api/pm/credential/c1/secret").param("field", "password"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.value").value("pw-Netflix-9f3e"));
        mvc.perform(get("/api/pm/credential/c1/secret").param("field", "custom:f2"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.value").value("multi-line-private-key"));
        mvc.perform(get("/api/pm/credential/c1/secret").param("field", "history:h1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.value").value("old-password-in-history"));
    }

    @Test
    void revealOfAnotherUsersCredentialIs404() throws Exception {
        String body = mvc.perform(get("/api/pm/credential/theirs/secret").param("field", "password"))
                .andExpect(status().isNotFound())
                .andReturn().getResponse().getContentAsString();
        assertThat(body).doesNotContain("\"value\"");

        // The same for user 8 asking for user 7's entry by its real id.
        signInAs(8L, "VIEWER");
        when(CREDENTIALS.findByIdAndPasswordManagerUserEntityUserId(any(), any())).thenReturn(Optional.empty());
        String probe = mvc.perform(get("/api/pm/credential/c1/secret").param("field", "password"))
                .andExpect(status().isNotFound())
                .andReturn().getResponse().getContentAsString();
        assertThat(probe).doesNotContain("pw-Netflix-9f3e");
    }

    @Test
    void theEditFormReadsEverySecretOfTheEntryAtOnceButOnlyTheOwners() throws Exception {
        mvc.perform(get("/api/pm/credential/c1/secrets")).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.password").value("pw-Netflix-9f3e"))
                .andExpect(jsonPath("$.data.customFields.f1").value("hidden-recovery-code"))
                .andExpect(jsonPath("$.data.customFields.f2").value("multi-line-private-key"));

        String theirs = mvc.perform(get("/api/pm/credential/theirs/secrets")).andExpect(status().isNotFound())
                .andReturn().getResponse().getContentAsString();
        assertThat(theirs).doesNotContain("\"password\"");
        mvc.perform(get("/api/pm/credential/c2/secrets")).andExpect(status().isNotFound());   // in Trash
    }

    @Test
    void revealOfATrashedEntryIs404() throws Exception {
        mvc.perform(get("/api/pm/credential/c2/secret").param("field", "password"))
                .andExpect(status().isNotFound());
    }

    @Test
    void revealOfAnUnknownFieldIs400() throws Exception {
        mvc.perform(get("/api/pm/credential/c1/secret").param("field", "username")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/pm/credential/c1/secret").param("field", "custom:")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/pm/credential/c1/secret")).andExpect(status().isBadRequest());
        // A field id that is not on the entry is a missing thing, not a malformed request.
        mvc.perform(get("/api/pm/credential/c1/secret").param("field", "custom:nope")).andExpect(status().isNotFound());
    }

    @Test
    void historyListsWhenEachPasswordWasReplacedButNotThePassword() throws Exception {
        String body = mvc.perform(get("/api/pm/credential/c1/history")).andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].id").value("h1"))
                .andReturn().getResponse().getContentAsString();
        assertThat(body).doesNotContain("old-password-in-history").doesNotContain("\"password\"");
    }

    @Test
    void theSnapshotIsTheFullOldStylePayload() throws Exception {
        mvc.perform(get("/api/pm/snapshot")).andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].host").value("netflix.com"))
                .andExpect(jsonPath("$.data[0].credentials.length()").value(1))   // live entries only
                .andExpect(jsonPath("$.data[0].credentials[0].password").value("pw-Netflix-9f3e"))
                .andExpect(jsonPath("$.data[0].credentials[0].customFields[0].fieldValue").value("hidden-recovery-code"));
    }

    @Test
    void snapshotEndpointRequiresAuth() throws Exception {
        // No token: the filter chain leaves an anonymous user, and @AnyRole turns it away with 401.
        SecurityContextHolder.getContext().setAuthentication(new AnonymousAuthenticationToken(
                "key", "anonymousUser", AuthorityUtils.createAuthorityList("ROLE_ANONYMOUS")));
        String body = mvc.perform(get("/api/pm/snapshot")).andExpect(status().isUnauthorized())
                .andReturn().getResponse().getContentAsString();
        assertThat(SECRETS).allSatisfy(secret -> assertThat(body).doesNotContain(secret));
        mvc.perform(get("/api/pm/credential/c1/secret").param("field", "password")).andExpect(status().isUnauthorized());

        // Signed in without a vault role: 403.
        signInAs(7L, "NOBODY");
        mvc.perform(get("/api/pm/snapshot")).andExpect(status().isForbidden());

        // And neither path is on the filter chain's public lists, so a request without a token never gets this far.
        PathPatternParser parser = new PathPatternParser();
        assertThat(Stream.concat(Stream.of(AppConstants.PUBLIC_APIS), Stream.of(AppConstants.PUBLIC_GET_APIS)))
                .noneMatch(p -> parser.parse(p).matches(PathContainer.parsePath("/api/pm/snapshot"))
                        || parser.parse(p).matches(PathContainer.parsePath("/api/pm/credential/c1/secret")));
    }
}
