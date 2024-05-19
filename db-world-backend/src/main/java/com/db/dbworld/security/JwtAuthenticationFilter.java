package com.db.dbworld.security;

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

import java.io.IOException;

@Component
@Log4j2
public class JwtAuthenticationFilter extends OncePerRequestFilter {
    @Autowired
    private JwtHelper jwtHelper;

    @Autowired
    private UserDetailsService userDetailsService;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain) throws ServletException, IOException {

        String username = null;
        String token = null;
        String errorMessage = null;

        //Authorization
        String bearerToken = request.getHeader("Authorization");
        if (bearerToken != null && bearerToken.startsWith("Bearer")) {
            //looking good
            token = bearerToken.substring(7);
            try {
                username = this.jwtHelper.getUsernameFromToken(token);
            } catch (IllegalArgumentException e) {
                errorMessage = "Illegal Argument while fetching the username !!";
            } catch (ExpiredJwtException e) {
                errorMessage = "Given jwt token is expired !!";
            } catch (MalformedJwtException e) {
                errorMessage = "Some changed has done in token !! Invalid Token";
            } catch (Exception e) {
                errorMessage = e.getMessage();
            }
            if(errorMessage != null) log.error(errorMessage);

            if (username != null && SecurityContextHolder.getContext().getAuthentication() == null) {

                //fetch user detail from username
                UserDetails userDetails = this.userDetailsService.loadUserByUsername(username);

                Boolean isTokenValidate = this.jwtHelper.validateToken(token, userDetails);
                log.info("User '{}' is accessing [Path:'{}'|Query:'{}'|Method:'{}'], Token Validate :  {}", userDetails.getUsername(), request.getRequestURI(), request.getQueryString(), request.getMethod(), isTokenValidate);
                if (isTokenValidate) {
                    //set the authentication
                    UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(userDetails, userDetails.getPassword(), userDetails.getAuthorities());
                    authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authentication);
                }
            }

        }
        filterChain.doFilter(request, response);
    }
}
