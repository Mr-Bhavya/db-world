package com.db.dbworld.handler;

import com.db.dbworld.payloads.ApiResponse;
import com.google.gson.Gson;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;

@Component
public class TokenAuthenticationHandler {

    @Component
    public static class JwtAuthenticationEntryPoint implements AuthenticationEntryPoint {

        @Override
        public void commence(HttpServletRequest request, HttpServletResponse response, AuthenticationException authException) throws IOException, ServletException {
            ApiResponse<String> apiResponse = new ApiResponse<>(HttpStatus.UNAUTHORIZED, false, authException.getMessage());
            response.setStatus(apiResponse.getHttpStatusCode());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.getWriter().write(new Gson().toJson(apiResponse));
        }
    }


    @Component
    public static class JwtAccessDeniedHandler implements AccessDeniedHandler {

        @Override
        public void handle(HttpServletRequest request, HttpServletResponse response, AccessDeniedException accessDeniedException) throws IOException, ServletException {
            ApiResponse<String> apiResponse = new ApiResponse<>(HttpStatus.FORBIDDEN, false, accessDeniedException.getMessage());
            response.setStatus(apiResponse.getHttpStatusCode());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.getWriter().write(new Gson().toJson(apiResponse));
        }

    }

    @Component
    @RequiredArgsConstructor
    public static final class BearerTokenAccessDeniedHandler implements AccessDeniedHandler {
        public void handle(final HttpServletRequest request, final HttpServletResponse response, final AccessDeniedException accessDeniedException) throws IOException {
            ApiResponse<String> apiResponse = new ApiResponse<>(HttpStatus.FORBIDDEN, false, accessDeniedException.getMessage());
            response.setStatus(apiResponse.getHttpStatusCode());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.getWriter().write(new Gson().toJson(apiResponse));

        }
    }

    @Component
    @RequiredArgsConstructor
    public static final class BearerTokenAuthenticationEntryPoint implements AuthenticationEntryPoint {
        public void commence(final HttpServletRequest request, final HttpServletResponse response, final AuthenticationException authException) throws IOException {
            ApiResponse<String> apiResponse = new ApiResponse<>(HttpStatus.UNAUTHORIZED, false, authException.getMessage());
            response.setStatus(apiResponse.getHttpStatusCode());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.getWriter().write(new Gson().toJson(apiResponse));
        }

    }

}
