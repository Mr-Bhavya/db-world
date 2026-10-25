package com.db.dbworld.app.pm.service;

import com.db.dbworld.app.admin.scheduler.dto.JobRunSummary;
import com.db.dbworld.app.pm.entity.CredentialEntity;
import com.db.dbworld.app.pm.entity.PasswordManagerEntity;
import com.db.dbworld.app.pm.mapper.PasswordManagerMapperImpl;
import com.db.dbworld.app.pm.repository.CredentialHistoryRepository;
import com.db.dbworld.app.pm.repository.CredentialsRepository;
import com.db.dbworld.app.pm.repository.HostRepository;
import com.db.dbworld.app.pm.repository.PasswordManagerRepository;
import com.db.dbworld.app.pm.service.impl.PasswordManagerServiceImpl;
import com.db.dbworld.app.pm.service.impl.TrashPurgeJob;
import com.db.dbworld.core.context.UserContext;
import com.db.dbworld.core.user.service.UserService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.annotation.EnableTransactionManagement;
import org.springframework.transaction.support.SimpleTransactionStatus;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The daily purge removes each entry in its own transaction. The service tests call the service
 * directly, where {@code @Transactional} does nothing, so they cannot show that. This one runs the
 * job against the service as Spring proxies it, with a recording transaction manager: every entry
 * must get a NEW transaction, and the one that fails must roll back without touching the others.
 */
class TrashPurgeTransactionTest {

    private static final Instant NOW = Instant.parse("2026-10-24T10:00:00Z");

    private static final CredentialsRepository CREDENTIALS = mock(CredentialsRepository.class);
    private static final PlatformTransactionManager TX = mock(PlatformTransactionManager.class);

    @Configuration
    @EnableTransactionManagement
    static class Config {
        @Bean
        PlatformTransactionManager transactionManager() {
            return TX;
        }

        @Bean
        PasswordManagerService service() {
            return new PasswordManagerServiceImpl(mock(PasswordManagerRepository.class), mock(HostRepository.class),
                    CREDENTIALS, mock(CredentialHistoryRepository.class), mock(UserService.class),
                    mock(UserContext.class), new PasswordManagerMapperImpl(), Clock.fixed(NOW, ZoneOffset.UTC));
        }
    }

    private AnnotationConfigApplicationContext context;
    private final List<TransactionStatus> started = new ArrayList<>();

    @BeforeEach
    void startContext() {
        reset(CREDENTIALS, TX);
        when(TX.getTransaction(any())).thenAnswer(i -> {
            TransactionStatus status = new SimpleTransactionStatus(true);
            started.add(status);
            return status;
        });
        context = new AnnotationConfigApplicationContext(Config.class);
    }

    @AfterEach
    void stopContext() {
        context.close();
    }

    private CredentialEntity trashed(String id, int daysAgo) {
        CredentialEntity c = new CredentialEntity();
        c.setId(id);
        c.setDeletedAt(NOW.minus(Duration.ofDays(daysAgo)));
        PasswordManagerEntity pm = new PasswordManagerEntity();
        pm.setCredentials(new ArrayList<>(List.of(c)));
        c.setPasswordManager(pm);
        when(CREDENTIALS.findById(id)).thenReturn(Optional.of(c));
        return c;
    }

    @Test
    void eachEntryIsRemovedInANewTransactionAndAFailureRollsBackOnlyItsOwn() {
        CredentialEntity first = trashed("c1", 31);
        CredentialEntity broken = trashed("c2", 32);
        CredentialEntity last = trashed("c3", 33);
        when(CREDENTIALS.findAllByDeletedAtBefore(any(Instant.class))).thenReturn(List.of(first, broken, last));
        doThrow(new IllegalStateException("db is unhappy")).when(CREDENTIALS).delete(broken);
        PasswordManagerService service = context.getBean(PasswordManagerService.class);
        var summary = JobRunSummary.builder();

        new TrashPurgeJob(service, Clock.fixed(NOW, ZoneOffset.UTC)).purgeExpired(summary);

        // One transaction for the list, then one per entry: three removals, three NEW transactions.
        ArgumentCaptor<TransactionDefinition> definitions = ArgumentCaptor.forClass(TransactionDefinition.class);
        verify(TX, times(4)).getTransaction(definitions.capture());
        List<TransactionDefinition> perEntry = definitions.getAllValues().subList(1, 4);
        assertThat(perEntry).allSatisfy(d ->
                assertThat(d.getPropagationBehavior()).isEqualTo(TransactionDefinition.PROPAGATION_REQUIRES_NEW));
        assertThat(definitions.getAllValues().get(0).isReadOnly()).isTrue();   // the list

        // The failing entry's transaction was rolled back, the other two committed.
        verify(TX, times(1)).rollback(started.get(2));
        verify(TX, times(1)).commit(started.get(1));
        verify(TX, times(1)).commit(started.get(3));
        verify(CREDENTIALS).delete(first);
        verify(CREDENTIALS).delete(last);
        assertThat(summary.build().counters()).containsEntry("entriesRemoved", 2L).containsEntry("entriesFailed", 1L);
    }
}
