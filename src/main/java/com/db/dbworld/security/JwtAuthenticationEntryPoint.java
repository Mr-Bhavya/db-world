package com.db.dbworld.security;

import com.db.dbworld.exceptions.TokenAuthenticationException;
import com.db.dbworld.payloads.ApiResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.PrintWriter;

@Component
public class JwtAuthenticationEntryPoint implements AuthenticationEntryPoint {

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response, AuthenticationException authException) throws IOException, ServletException {
        ApiResponse apiResponse = new ApiResponse(HttpStatus.valueOf(HttpServletResponse.SC_UNAUTHORIZED), false, "You don't have valid token. Please login again !!");
        response.setStatus(apiResponse.getHttpStatusCode());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);

        final ObjectMapper mapper = new ObjectMapper();
        mapper.writeValue(response.getOutputStream(), apiResponse);
    }
}

