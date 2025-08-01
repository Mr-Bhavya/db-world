package com.db.dbworld.security;

import com.db.dbworld.entities.user.UserEntity;
import com.db.dbworld.services.user.UserActivityLogService;
import com.db.dbworld.services.user.UserService;
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

@Component
@Log4j2
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final List<String> EXCLUDED_URI_PATTERNS = List.of(
            "/favicon.ico", "/logo", "/js/bootstrap.min.js",
            "/static/", "/manifest.json", "/actuator/health"
    );

    private static final List<String> TRACKED_METHODS = List.of("POST", "PUT", "DELETE", "PATCH");

    @Autowired
    private UserService userService;

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
            filterChain.doFilter(cachingRequest, response);
        } finally {
            if (shouldTrackRequest(request)) {
                logRequestDetails(cachingRequest, response, startTime);
            }
            ThreadContext.clearAll(); // 🔁 Always clear context after each request
        }
    }

    private boolean shouldTrackRequest(HttpServletRequest request) {
        return TRACKED_METHODS.contains(request.getMethod()) ||
                !request.getRequestURI().startsWith("/actuator");
    }

    private void logRequestDetails(HttpServletRequest request, HttpServletResponse response, long startTime) {
        String requestBody = getRequestBody(request);
        String method = request.getMethod();
        String uri = request.getRequestURI();
        String query = request.getQueryString();
        int status = response.getStatus();
        long duration = System.currentTimeMillis() - startTime;

        UserEntity user = extractUser(request).orElse(null);
        String userEmail = (user != null) ? user.getEmail() : "Anonymous";

        // Set log context using ThreadContext
        ThreadContext.put("user", userEmail);
        ThreadContext.put("method", method);
        ThreadContext.put("uri", uri);
        ThreadContext.put("query", query);
        ThreadContext.put("status", String.valueOf(status));
        ThreadContext.put("duration", String.valueOf(duration));

        log.info("User '{}' completed {} {} {}", userEmail, method, uri, query);

        if (shouldPersistToDatabase(request)) {
            activityLogService.logActivity(request, response, duration, user, requestBody);
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
