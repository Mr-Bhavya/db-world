package com.db.dbworld.services.user;

import com.db.dbworld.dao.user.UserActivityLogRepository;
import com.db.dbworld.entities.user.UserActivityLogEntity;
import com.db.dbworld.payloads.RequestLogData;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Log4j2
@Service
@Transactional
@RequiredArgsConstructor
public class UserActivityLogService {

    private final UserActivityLogRepository logRepository;

    // Use a dedicated executor for logging
    private final ExecutorService loggingExecutor = Executors.newFixedThreadPool(
            Runtime.getRuntime().availableProcessors(),
            r -> {
                Thread t = new Thread(r, "activity-logging-" + System.currentTimeMillis());
                t.setDaemon(true);
                t.setPriority(Thread.MIN_PRIORITY);
                return t;
            }
    );

    /**
     * Async logging using extracted data (not request/response objects)
     */
    public void logActivity(com.db.dbworld.payloads.RequestLogData logData) {
        CompletableFuture.runAsync(() -> {
            try {
                logActivityInternal(logData);
            } catch (Exception e) {
                log.error("Async activity logging failed for URI: {}", logData.getUri(), e);
            }
        }, loggingExecutor);
    }

    /**
     * Internal method that does the actual logging
     */
    private void logActivityInternal(RequestLogData logData) {
        // Truncate very long request bodies to prevent DB issues
        String truncatedRequestBody = truncateRequestBody(logData.getRequestBody(), 4000);

        try {
            UserActivityLogEntity logEntry = UserActivityLogEntity.builder()
                    .user(logData.getUser())
                    .method(logData.getMethod())
                    .uri(logData.getUri())
                    .query(logData.getQuery())
                    .ip(logData.getIp())
                    .userAgent(logData.getUserAgent())
                    .status(logData.getStatus())
                    .duration(logData.getDuration())
                    .timestamp(LocalDateTime.now())
                    .requestId(logData.getRequestId())
                    .requestBody(truncatedRequestBody)
                    .build();

            logRepository.save(logEntry);

            log.debug("Successfully logged activity for user: {}, URI: {}, Status: {}",
                    logData.getUserEmail(), logData.getUri(), logData.getStatus());

        } catch (Exception e) {
            log.error("Failed to save activity log for URI: {}, User: {}",
                    logData.getUri(), logData.getUserEmail(), e);
        }
    }

    /**
     * Truncate request body to prevent database issues with very large payloads
     */
    private String truncateRequestBody(String requestBody, int maxLength) {
        if (requestBody == null || requestBody.length() <= maxLength) {
            return requestBody;
        }
        return requestBody.substring(0, maxLength) + "... [truncated]";
    }

    @Transactional(readOnly = true)
    public Page<UserActivityLogEntity> getFilteredLogs(String username, String method, Integer status,
                                                       String uri, String ip, String requestId,
                                                       LocalDateTime startDate, LocalDateTime endDate,
                                                       Pageable pageable) {
        return logRepository.findByFilters(username, method, status, uri, ip,
                requestId, startDate, endDate, pageable);
    }

    /**
     * Cleanup executor on application shutdown
     */
    public void shutdown() {
        if (!loggingExecutor.isShutdown()) {
            loggingExecutor.shutdown();
        }
    }

}