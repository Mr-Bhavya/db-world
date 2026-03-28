package com.db.dbworld.filters;

import com.db.dbworld.core.context.RequestContext;
import com.db.dbworld.core.user.entity.UserEntity;
import com.db.dbworld.payloads.RequestLogData;
import com.db.dbworld.services.user.UserActivityLogService;
import com.db.dbworld.core.user.service.UserService;
import com.db.dbworld.utils.DbWorldUtils;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.log4j.Log4j2;
import org.apache.logging.log4j.ThreadContext;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.ContentCachingRequestWrapper;

import java.io.IOException;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;

@Component
@Log4j2
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final List<String> EXCLUDED_URI_PATTERNS = List.of(
            "/favicon.ico", "/logo", "/js/bootstrap.min.js",
            "/static/", "/manifest.json", "/actuator/health", "/ws"
    );

    private static final List<String> TRACKED_METHODS = List.of("POST", "PUT", "DELETE", "PATCH");

    @Autowired
    private UserService userService;

    @Autowired
    private DbWorldUtils dbWorldUtils;

    private final UserActivityLogService activityLogService;

    public JwtAuthenticationFilter(UserActivityLogService activityLogService) {
        this.activityLogService = activityLogService;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return EXCLUDED_URI_PATTERNS.stream()
                .anyMatch(pattern -> request.getRequestURI().startsWith(pattern));
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        ContentCachingRequestWrapper cachingRequest = new ContentCachingRequestWrapper(request);
        long startTime = System.currentTimeMillis();

        try {
            ThreadContext.put("requestId", RequestContext.getRequestId());
            ThreadContext.put("traceId", RequestContext.getTraceId());
            filterChain.doFilter(cachingRequest, response);
        } finally {
            if (shouldTrackRequest(cachingRequest)) {
                // Extract all data BEFORE async operation
                RequestLogData logData = extractRequestLogData(cachingRequest, response, startTime);

                // Fire and forget - pass only the extracted data, not the request/response objects
                CompletableFuture.runAsync(() -> {
                    logRequestDetails(logData);
                }).exceptionally(throwable -> {
                    log.error("Async logging failed for URI: {}", logData.getUri(), throwable);
                    return null;
                });
            }
            ThreadContext.clearAll();
        }
    }

    private boolean shouldTrackRequest(HttpServletRequest request) {
        return TRACKED_METHODS.contains(request.getMethod()) ||
                !request.getRequestURI().startsWith("/actuator");
    }

    /**
     * Extract all required data from request/response before they become invalid
     */
    private RequestLogData extractRequestLogData(HttpServletRequest request, HttpServletResponse response, long startTime) {
        String requestBody = getRequestBody(request);
        String method = request.getMethod();
        String uri = request.getRequestURI();
        String query = request.getQueryString();
        int status = response.getStatus();
        long duration = System.currentTimeMillis() - startTime;

        UserEntity user = extractUser(request).orElse(null);
        String userEmail = (user != null) ? user.getEmail() : "Anonymous";

        String ip = dbWorldUtils.getClientIpAddress(request);
        String userAgent = request.getHeader("User-Agent");
        String requestId = RequestContext.getRequestId();

        boolean shouldPersist = shouldPersistToDatabase(request);

        return RequestLogData.builder()
                .user(user)
                .userEmail(userEmail)
                .method(method)
                .uri(uri)
                .query(query)
                .ip(ip)
                .userAgent(userAgent)
                .status(status)
                .duration(duration)
                .isRequest(true)
                .requestId(requestId)
                .requestBody(requestBody)
                .shouldPersist(shouldPersist)
                .build();
    }

    private void logRequestDetails(RequestLogData logData) {
        // Set log context using ThreadContext
        ThreadContext.put("isRequest", String.valueOf(logData.isRequest()));
        ThreadContext.put("user", logData.getUserEmail());
        ThreadContext.put("method", logData.getMethod());
        ThreadContext.put("uri", logData.getUri());
        ThreadContext.put("query", logData.getQuery());
        ThreadContext.put("status", String.valueOf(logData.getStatus()));
        ThreadContext.put("duration", String.valueOf(logData.getDuration()));

        log.info("User '{}' completed {} {} in {}ms",
                logData.getUserEmail(), logData.getMethod(), logData.getUri(), logData.getDuration());

        if (logData.isShouldPersist()) {
            activityLogService.logActivity(logData);
        }
    }

    private Optional<UserEntity> extractUser(HttpServletRequest request) {
        try {
            String uri = request.getRequestURI();
            String tokenFromQuery = request.getParameter("t");

            if ((uri.startsWith("/api/stream/watch") || uri.startsWith("/api/stream/download")) && tokenFromQuery != null) {
                return Optional.ofNullable(userService.getUserEntityByEmail(
                        userService.getUserFromToken(tokenFromQuery)
                ));
            } else {
                return Optional.ofNullable(userService.getUserFromToken());
            }
        } catch (Exception e) {
            log.debug("No user found from token, defaulting to anonymous: {}", e.getMessage());
            return Optional.empty();
        }
    }

    private String getRequestBody(HttpServletRequest request) {
        try {
            return new String(((ContentCachingRequestWrapper) request).getContentAsByteArray(), request.getCharacterEncoding());
        } catch (Exception e) {
            return "";
        }
    }

    private boolean shouldPersistToDatabase(HttpServletRequest request) {
        return TRACKED_METHODS.contains(request.getMethod()) ||
                request.getRequestURI().startsWith("/api");
    }

}