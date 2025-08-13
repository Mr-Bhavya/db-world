package com.db.dbworld.services.user;

import com.db.dbworld.dao.user.UserActivityLogRepository;
import com.db.dbworld.entities.user.UserActivityLogEntity;
import com.db.dbworld.entities.user.UserEntity;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Log4j2
@Service
@RequiredArgsConstructor
public class UserActivityLogService {

    private final UserActivityLogRepository logRepository;
    private final ExecutorService executor = Executors.newCachedThreadPool();

    public void logActivity(HttpServletRequest request, HttpServletResponse response, long duration, UserEntity userEntity, String requestBody) {
        // Extract required values before the async task
        String method = request.getMethod();
        String uri = request.getRequestURI();
        String query = request.getQueryString();
        String ip = request.getRemoteAddr();
        String userAgent = request.getHeader("User-Agent");
        int status = response.getStatus();
        String requestId = request.getHeader("X-Request-ID");
        LocalDateTime timestamp = LocalDateTime.now();

        executor.submit(() -> {
            try {
                UserActivityLogEntity logEntry = UserActivityLogEntity.builder()
                        .user(userEntity)
                        .method(method)
                        .uri(uri)
                        .query(query)
                        .ip(ip)
                        .userAgent(userAgent)
                        .status(status)
                        .duration(duration)
                        .timestamp(timestamp)
                        .requestId(requestId)
                        .requestBody(requestBody)
                        .build();

                logRepository.save(logEntry);
            } catch (Exception e) {
                log.error("Async logging failed", e);
            }
        });
    }


    public Page<UserActivityLogEntity> getFilteredLogs(String username, String method, Integer status,
                                                       String uri, String ip, String requestId,
                                                       LocalDateTime startDate, LocalDateTime endDate,
                                                       Pageable pageable) {
        return logRepository.findByFilters(username, method, status, uri, ip,
                requestId, startDate, endDate, pageable);
    }
}
