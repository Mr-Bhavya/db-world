package com.db.dbworld.security;

import com.db.dbworld.entities.user.UserEntity;
import com.db.dbworld.services.UserActivityLogService;
import com.db.dbworld.services.UserService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.log4j.Log4j2;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
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

    @Autowired
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
                String requestBody = new String(cachingRequest.getContentAsByteArray(), request.getCharacterEncoding());
                logRequestDetails(cachingRequest, response, startTime, requestBody);
            }
        }
    }

    private boolean shouldTrackRequest(HttpServletRequest request) {
        return TRACKED_METHODS.contains(request.getMethod()) ||
                !request.getRequestURI().startsWith("/actuator");
    }

    private void logRequestDetails(HttpServletRequest request, HttpServletResponse response, long startTime, String requestBody) {
        UserEntity userEntity = null;

        try {
            String uri = request.getRequestURI();
            String tokenFromQuery = request.getParameter("t");

            if ((uri.startsWith("/api/stream/watch") || uri.startsWith("/api/stream/download")) && tokenFromQuery != null) {
                userEntity = userService.getUserEntityByEmail(userService.getUserFromToken(tokenFromQuery));
            } else {
                userEntity = userService.getUserFromToken(); // default from Authorization header
            }
        } catch (Exception e) {
            log.debug("No user found from token, defaulting to anonymous: {}", e.getMessage());
        }

        String method = request.getMethod();
        String uri = request.getRequestURI();
        String query = request.getQueryString();
        int status = response.getStatus();
        long duration = System.currentTimeMillis() - startTime;

        MDC.put("user", userEntity != null ? userEntity.getEmail() : "Anonymous");
        MDC.put("method", method);
        MDC.put("uri", uri);
        MDC.put("status", String.valueOf(status));
        MDC.put("duration", String.valueOf(duration));

        log.info("API Request - {} {} {} [{}] | User: {} | Time: {}ms",
                method, uri, query, status, userEntity != null ? userEntity.getEmail() : "Anonymous", duration);

        if (shouldPersistToDatabase(request)) {
            activityLogService.logActivity(request, response, duration, userEntity, requestBody);
        }

        MDC.clear();
    }

    private boolean shouldPersistToDatabase(HttpServletRequest request) {
        String method = request.getMethod();
        return TRACKED_METHODS.contains(method) ||
                request.getRequestURI().startsWith("/api") ;
    }
}