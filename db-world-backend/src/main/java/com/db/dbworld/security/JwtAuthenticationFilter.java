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
                extractRequest(request, isTokenValidate, userDetails.getUsername());
                if (isTokenValidate) {
                    //set the authentication
                    UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(userDetails, userDetails.getPassword(), userDetails.getAuthorities());
                    authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authentication);
                }
            }
        }else{
            if(!request.getRequestURI().contains("/favicon.ico") && !request.getRequestURI().contains("/logo")
                    && !request.getRequestURI().contains("/js/bootstrap.min.js") && !request.getRequestURI().contains("/DB_World_teal_circle.png")
                    && !request.getRequestURI().contains("/manifest.json") && !request.getRequestURI().contains("/db-world/DB_World_teal_circle.png")
                    && !request.getRequestURI().contains("/db-world/db-password-manager/DB_World_teal_circle.png'") && !request.getRequestURI().contains("/static/css/")
                    && !request.getRequestURI().contains("/static/js/") && !request.getRequestURI().contains("/static/media/")
                    && !request.getRequestURI().contains("/js/bootstrap.min.js") && !request.getRequestURI().contains("/js/bootstrap.min.js")){
                extractRequest(request, false, null);
            }

        }
        filterChain.doFilter(request, response);
    }

    private void extractRequest(HttpServletRequest request, boolean isTokenValidate, String user) {
        String message = "\r\n---------------------------------------\r\n";
//        message += "Time: [" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("dd/MM/yyyy, hh:mm:ss a")) + "]; ";
        message += isTokenValidate ? "** " + user + " ** & " : "User ";
//        message += "User-Agent: [" + request.getHeader("User-Agent") + "] ";
        message += "is accessing API: [" + request.getRequestURL() + " | Query = " + request.getQueryString() + " | Method = "+ request.getMethod();
        message += "] " + "from frontend url: [" + request.getHeader("Referer") + "]. ";
//        message += "and from remote: [" + request.getRemoteHost()+":"+request.getRemotePort() + "]; ";
        message += "Token Validate: " + isTokenValidate + "; ";
        message += "\r\n---------------------------------------";
        log.info(message);
//        System.out.println(message);
    }

}
