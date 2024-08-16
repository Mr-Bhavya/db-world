package com.db.dbworld.config;

import com.db.dbworld.exceptions.DbWorldException;
import com.db.dbworld.security.JwtAuthenticationFilter;
import com.db.dbworld.security.TokenAuthenticationHandler;
import com.db.dbworld.utils.DbWorldConstants;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {
    @Autowired
    private TokenAuthenticationHandler.JwtAuthenticationEntryPoint jwtAuthenticationEntryPoint;
    @Autowired
    private TokenAuthenticationHandler.JwtAccessDeniedHandler jwtAccessDeniedHandler;
    @Autowired
    private JwtAuthenticationFilter filter;

    @Autowired
    private UserDetailsService userDetailsService;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) {

        try {
            return http.csrf(csrf -> csrf.disable())
                    .authorizeHttpRequests(
                            authorizationManagerRequestMatcherRegistry ->
                                    authorizationManagerRequestMatcherRegistry
                                            .requestMatchers(DbWorldConstants.PUBLIC_APIS).permitAll()
                                            .anyRequest().authenticated())
                    .exceptionHandling(ex -> ex.authenticationEntryPoint(jwtAuthenticationEntryPoint))
                    .exceptionHandling(ex -> ex.accessDeniedHandler(jwtAccessDeniedHandler))
                    .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                    .addFilterBefore(filter, UsernamePasswordAuthenticationFilter.class)
                    .build();
        } catch (Exception e) {
            throw new DbWorldException(e.getMessage());
        }
    }

    @Bean
    public DaoAuthenticationProvider daoAuthenticationProvider() {
        DaoAuthenticationProvider daoAuthenticationProvider = new DaoAuthenticationProvider();
        daoAuthenticationProvider.setUserDetailsService(userDetailsService);
        daoAuthenticationProvider.setPasswordEncoder(passwordEncoder);
        return daoAuthenticationProvider;
    }

}
