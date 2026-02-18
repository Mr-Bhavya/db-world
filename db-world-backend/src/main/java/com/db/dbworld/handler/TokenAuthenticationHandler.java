package com.db.dbworld.handler;

import com.db.dbworld.payloads.ApiResponse;
import com.google.gson.Gson;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;

@Component
public class TokenAuthenticationHandler {

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
            writeResponse(response, 401, ex.getMessage());
        }
    }

    @Component
    public static class JwtAccessDeniedHandler implements AccessDeniedHandler {
        @Override
        public void handle(HttpServletRequest request, HttpServletResponse response, AccessDeniedException ex) throws IOException {
            writeResponse(response, 403, ex.getMessage());
        }
    }

    @Component
    public static final class BearerTokenAccessDeniedHandler implements AccessDeniedHandler {
        @Override
        public void handle(HttpServletRequest request, HttpServletResponse response, AccessDeniedException ex) throws IOException {
            writeResponse(response, 403, ex.getMessage());
        }
    }

    @Component
    public static final class BearerTokenAuthenticationEntryPoint implements AuthenticationEntryPoint {
        @Override
        public void commence(HttpServletRequest request, HttpServletResponse response, AuthenticationException ex) throws IOException {
            writeResponse(response, 401, ex.getMessage());
        }
    }
}
