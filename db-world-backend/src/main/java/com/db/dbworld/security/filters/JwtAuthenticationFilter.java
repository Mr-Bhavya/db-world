package com.db.dbworld.security.filters;

import com.db.dbworld.core.context.RequestContext;
import com.db.dbworld.core.context.UserContext;
import com.db.dbworld.payloads.RequestLogData;
import com.db.dbworld.audit.activity.service.UserActivityLogService;
import com.db.dbworld.core.user.service.UserService;
import com.db.dbworld.security.auth.JwtService;
import com.db.dbworld.security.dto.CurrentUser;
import com.db.dbworld.utils.DbWorldUtils;
import jakarta.annotation.Nonnull;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.apache.logging.log4j.ThreadContext;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.ContentCachingRequestWrapper;

import java.io.IOException;
import java.util.List;
import java.util.concurrent.CompletableFuture;

@Component
@Log4j2
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final List<String> EXCLUDED_URI_PATTERNS = List.of(
            "/favicon.ico", "/logo", "/js/bootstrap.min.js",
            "/static/", "/manifest.json", "/actuator/health", "/ws"
    );

    private static final List<String> TRACKED_METHODS = List.of("POST", "PUT", "DELETE", "PATCH");

    private final DbWorldUtils dbWorldUtils;

    private final JwtService jwtService;

    private final UserContext userContext;

    private final UserActivityLogService activityLogService;

    @Override
    protected boolean shouldNotFilter(@Nonnull HttpServletRequest request) {
        return EXCLUDED_URI_PATTERNS.stream()
                .anyMatch(pattern -> request.getRequestURI().startsWith(pattern));
    }

    @Override
    protected void doFilterInternal(@Nonnull HttpServletRequest request, @Nonnull HttpServletResponse response, FilterChain filterChain)
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

        long duration = System.currentTimeMillis() - startTime;

        RequestLogData.RequestLogDataBuilder builder = RequestLogData.builder()
                .method(request.getMethod())
                .uri(request.getRequestURI())
                .query(request.getQueryString())
                .ip(dbWorldUtils.getClientIpAddress(request))
                .userAgent(request.getHeader("User-Agent"))
                .status(response.getStatus())
                .duration(duration)
                .requestId(RequestContext.getRequestId())
                .requestBody(getRequestBody(request))
                .isRequest(true)
                .shouldPersist(shouldPersistToDatabase(request));

        enrichUser(builder, request);

        return builder.build();
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

    private void enrichUser(RequestLogData.RequestLogDataBuilder builder, HttpServletRequest request) {

        try {
            String uri = request.getRequestURI();
            String token = request.getParameter("t");

            if (isStreamUri(uri) && token != null) {
                // ✅ decode JWT directly (NO DB)
                CurrentUser tokenUser = jwtService.parse(token);

                builder.userId(tokenUser.userId());
                builder.userEmail(tokenUser.email());

            } else {
                // ✅ normal flow (from SecurityContext)
                builder.userId(userContext.userId());
                builder.userEmail(userContext.email());
            }

        } catch (Exception e) {
            builder.userEmail("Anonymous");
        }
    }

    private boolean isStreamUri(String uri) {
        return uri.startsWith("/api/stream/watch")
                || uri.startsWith("/api/stream/download");
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