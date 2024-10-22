package com.db.dbworld.handler;

import com.db.dbworld.payloads.ApiResponse;
import com.google.gson.Gson;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
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
            String message = "I can see that, you are sending some request like ('/pmd/index.php', '/.aws/credentials', '/www/.git/config', '/?<play>withme</>', '/boaform/admin/formLogin') on my server. " +
                    "Are you a Hacker? Are you trying to access data by sending some query? " +
                    "If yes then let me know you are able to access it or not. Also can you please provide some feedback and suggestion" +
                    " So I can improve my code and security accordingly." +
                    "Also you can contact me on Email: dbmovies0@gmail.com";
//            ApiResponse apiResponse = new ApiResponse(HttpStatus.UNAUTHORIZED, false, message);
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

/*
        @Override
        public void handle(HttpServletRequest request, HttpServletResponse response, AccessDeniedException accessDeniedException) throws IOException, ServletException {
            ApiResponse apiResponse = new ApiResponse(HttpStatus.valueOf(HttpServletResponse.SC_FORBIDDEN), false, "You don't have required role to perform this action.");
            response.setStatus(apiResponse.getHttpStatusCode());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);

            final ObjectMapper mapper = new ObjectMapper();
            mapper.writeValue(response.getOutputStream(), apiResponse);
        }
 */

    }

}
