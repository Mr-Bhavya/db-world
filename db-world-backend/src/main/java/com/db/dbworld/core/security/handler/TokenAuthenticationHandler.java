package com.db.dbworld.core.security.handler;

import com.db.dbworld.api.response.ApiResponse;
import com.google.gson.Gson;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;

/**
 * Centralised HTTP-layer authentication and authorization error handlers.
 * Migrated from com.db.dbworld.handler.TokenAuthenticationHandler.
 */
@Component
public class TokenAuthenticationHandler {

    private static final Logger log = LogManager.getLogger(TokenAuthenticationHandler.class);

    private static final Gson GSON = new Gson();

    private static void writeResponse(HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.getWriter().write(GSON.toJson(ApiResponse.error(status, message)));
    }

    @Component
    public static class JwtAuthenticationEntryPoint implements AuthenticationEntryPoint {
        @Override
        public void commence(HttpServletRequest request, HttpServletResponse response, AuthenticationException ex) throws IOException {
            log.warn("Unauthenticated request → 401 for {} {}: {}",
                    request.getMethod(), request.getRequestURI(), ex.getMessage());
            writeResponse(response, 401, ex.getMessage());
        }
    }

    @Component
    public static class JwtAccessDeniedHandler implements AccessDeniedHandler {
        @Override
        public void handle(HttpServletRequest request, HttpServletResponse response, AccessDeniedException ex) throws IOException {
            log.warn("Access denied → 403 for {} {}: {}",
                    request.getMethod(), request.getRequestURI(), ex.getMessage());
            writeResponse(response, 403, ex.getMessage());
        }
    }

    @Component
    public static final class BearerTokenAccessDeniedHandler implements AccessDeniedHandler {
        @Override
        public void handle(HttpServletRequest request, HttpServletResponse response, AccessDeniedException ex) throws IOException {
            log.warn("Bearer token access denied → 403 for {} {}: {}",
                    request.getMethod(), request.getRequestURI(), ex.getMessage());
            writeResponse(response, 403, ex.getMessage());
        }
    }

    @Component
    public static final class BearerTokenAuthenticationEntryPoint implements AuthenticationEntryPoint {
        @Override
        public void commence(HttpServletRequest request, HttpServletResponse response, AuthenticationException ex) throws IOException {
            log.warn("Bearer token authentication failed → 401 for {} {}: {}",
                    request.getMethod(), request.getRequestURI(), ex.getMessage());
            writeResponse(response, 401, ex.getMessage());
        }
    }
}
