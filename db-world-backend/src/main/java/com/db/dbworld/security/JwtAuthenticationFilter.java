package com.db.dbworld.security;

import com.db.dbworld.exceptions.InvalidJwtAuthenticationException;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.MalformedJwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import javax.security.sasl.AuthenticationException;
import java.io.IOException;
import java.util.List;

@Component
@Log4j2
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final List<String> EXCLUDED_URI_PATTERNS = List.of(
            "/favicon.ico", "/logo", "/js/bootstrap.min.js", "/DB_World_teal_circle.png",
            "/manifest.json", "/db-world/DB_World_teal_circle.png", "/db-world/db-password-manager/DB_World_teal_circle.png",
            "/static/css/", "/static/js/", "/static/media/"
    );

    @Autowired
    private JwtHelper jwtHelper;

    @Autowired
    private UserDetailsService userDetailsService;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        // Bypass OPTIONS requests (commonly used for CORS preflight)
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            filterChain.doFilter(request, response);
            return;
        }

        String username = null;
        String token = null;
        String errorMessage = null;

        // Extract Authorization header
        String bearerToken = request.getHeader("Authorization");
        if (bearerToken != null && bearerToken.startsWith("Bearer ")) {
            token = bearerToken.substring(7).trim();
            if (token.isEmpty()) {
                errorMessage = "Empty token after Bearer prefix";
                log.error("{}", errorMessage);
                throw new InvalidJwtAuthenticationException(errorMessage);
            }
            try {
                username = jwtHelper.getUsernameFromToken(token);
            } catch (IllegalArgumentException e) {
                errorMessage = "Illegal argument while fetching the username";
            } catch (ExpiredJwtException e) {
                errorMessage = "JWT token is expired";
            } catch (MalformedJwtException e) {
                errorMessage = "Token has been tampered with. Invalid token";
            } catch (Exception e) {
                // Avoid exposing internal details
                errorMessage = "Unable to parse JWT token";
            }

            if (errorMessage != null) {
                log.error("JWT Error: {}", errorMessage);
                throw new InvalidJwtAuthenticationException(errorMessage);
            }

            // Validate token and set authentication if valid
            if (username != null && SecurityContextHolder.getContext().getAuthentication() == null) {
                UserDetails userDetails = userDetailsService.loadUserByUsername(username);
                boolean isTokenValid = jwtHelper.validateToken(token, userDetails);
                extractRequest(request, isTokenValid, userDetails.getUsername());
                if (isTokenValid) {
                    UsernamePasswordAuthenticationToken authentication =
                            new UsernamePasswordAuthenticationToken(userDetails, null, userDetails.getAuthorities());
                    authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authentication);
                }
            }
        } else {
            // Log request for non-Authorization calls if the URI is not in the exclusion list
            if (!isExcludedURI(request.getRequestURI())) {
//                extractRequest(request, false, null);
            }
        }
        filterChain.doFilter(request, response);
    }

    /**
     * Helper method to check if the request URI matches any excluded patterns.
     */
    private boolean isExcludedURI(String uri) {
        return EXCLUDED_URI_PATTERNS.stream().anyMatch(uri::contains);
    }

    /**
     * Logs the request details. Uses parameterized logging for clarity and performance.
     */
    private void extractRequest(HttpServletRequest request, boolean isTokenValid, String user) {
        log.info("User {} is accessing API: {} | Query: {} | Method: {} from Referer: {}. Token Validated: {}",
                isTokenValid ? user : "Anonymous",
                request.getRequestURL(),
                request.getQueryString(),
                request.getMethod(),
                request.getHeader("Referer"),
                isTokenValid);
    }
}
