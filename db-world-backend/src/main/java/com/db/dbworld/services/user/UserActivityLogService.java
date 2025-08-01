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
        executor.submit(() -> {
            try {
                String ip = request.getRemoteAddr();
                String userAgent = request.getHeader("User-Agent");
                String requestId = request.getHeader("X-Request-ID");

                UserActivityLogEntity logEntry = UserActivityLogEntity.builder()
                        .user(userEntity)
                        .method(request.getMethod())
                        .uri(request.getRequestURI())
                        .query(request.getQueryString())
                        .ip(ip)
                        .userAgent(userAgent)
                        .status(response.getStatus())
                        .duration(duration)
                        .timestamp(LocalDateTime.now())
                        .requestId(requestId)
                        .requestBody(requestBody)
                        .build();

                logRepository.save(logEntry);
            } catch (Exception e) {
                log.error("Async logging failed: {}", e.getMessage());
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
