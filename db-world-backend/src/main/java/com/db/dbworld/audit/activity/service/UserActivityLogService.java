package com.db.dbworld.audit.activity.service;

import com.db.dbworld.audit.activity.entity.UserActivityLogEntity;
import com.db.dbworld.audit.activity.repository.UserActivityLogRepository;
import com.db.dbworld.payloads.RequestLogData;

import lombok.extern.log4j.Log4j2;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDateTime;

@Log4j2
@Service
public class UserActivityLogService {

    private final UserActivityLogRepository logRepository;
    private final TransactionTemplate auditTransaction;

    public UserActivityLogService(UserActivityLogRepository logRepository, PlatformTransactionManager transactionManager) {
        this.logRepository = logRepository;
        this.auditTransaction = new TransactionTemplate(transactionManager);
        this.auditTransaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        this.auditTransaction.setTimeout(10);
    }

    // ==============================
    // ✅ ASYNC LOGGING (SPRING MANAGED)
    // ==============================
    @Async
    public void logActivity(RequestLogData logData) {
        try {
            saveLog(logData);
        } catch (Exception e) {
            log.error("Failed to log activity for URI: {}", logData.getUri(), e);
        }
    }

    private void saveLog(RequestLogData logData) {

        UserActivityLogEntity entity = UserActivityLogEntity.builder()
                .userId(logData.getUserId())
                .userEmail(logData.getUserEmail())
                .method(logData.getMethod())
                .uri(logData.getUri())
                .query(logData.getQuery())
                .requestBody(truncate(logData.getRequestBody()))
                .ip(logData.getIp())
                .userAgent(logData.getUserAgent())
                .status(logData.getStatus())
                .duration(logData.getDuration())
                .requestId(logData.getRequestId())
                .timestamp(LocalDateTime.now())
                .build();

        auditTransaction.executeWithoutResult(status -> logRepository.saveAndFlush(entity));
    }

    private String truncate(String body) {
        if (body == null) return null;
        return body.length() > 4000
                ? body.substring(0, 4000) + "...[truncated]"
                : body;
    }

    // ==============================
    // ✅ FILTERED LOGS
    // ==============================
    @Transactional(readOnly = true)
    public Page<UserActivityLogEntity> getFilteredLogs(
            String userEmail,
            String method,
            Integer status,
            String uri,
            String ip,
            String requestId,
            LocalDateTime startDate,
            LocalDateTime endDate,
            Pageable pageable
    ) {
        return logRepository.findByFilters(
                userEmail, method, status, uri, ip, requestId, startDate, endDate, pageable
        );
    }
}