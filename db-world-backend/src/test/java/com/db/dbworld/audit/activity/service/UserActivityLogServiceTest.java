package com.db.dbworld.audit.activity.service;

import com.db.dbworld.audit.activity.repository.UserActivityLogRepository;
import com.db.dbworld.payloads.RequestLogData;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.SimpleTransactionStatus;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class UserActivityLogServiceTest {
    @Test void auditInsertUsesAnIndependentBoundedTransaction() {
        var repository = mock(UserActivityLogRepository.class);
        var transactions = mock(PlatformTransactionManager.class);
        var status = new SimpleTransactionStatus();
        when(transactions.getTransaction(any())).thenReturn(status);
        new UserActivityLogService(repository, transactions).logActivity(RequestLogData.builder().uri("/api/downloader/inspect").build());
        verify(transactions).getTransaction(argThat(definition -> definition.getTimeout() == 10
                && definition.getPropagationBehavior() == TransactionDefinition.PROPAGATION_REQUIRES_NEW));
        verify(repository).saveAndFlush(any());
        verify(transactions).commit(status);
    }

    @Test void failedAuditInsertRollsBackWithoutBreakingTheRequest() {
        var repository = mock(UserActivityLogRepository.class);
        var transactions = mock(PlatformTransactionManager.class);
        var status = new SimpleTransactionStatus();
        when(transactions.getTransaction(any())).thenReturn(status);
        when(repository.saveAndFlush(any())).thenThrow(new IllegalStateException("Database unavailable"));
        new UserActivityLogService(repository, transactions).logActivity(RequestLogData.builder().uri("/api/downloader/inspect").build());
        verify(transactions).rollback(status);
        verify(transactions, never()).commit(any());
    }
}