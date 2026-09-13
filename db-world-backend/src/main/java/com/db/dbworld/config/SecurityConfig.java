package com.db.dbworld.config;

import com.db.dbworld.core.security.handler.TokenAuthenticationHandler;
import com.db.dbworld.security.auth.CustomAuthenticationProvider;
import lombok.extern.log4j.Log4j2;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Log4j2
@Configuration
@EnableMethodSecurity
@EnableConfigurationProperties(CorsProperties.class)
public class SecurityConfig {

    /**
     * Origins allowed to make CREDENTIALED cross-origin calls. Externalised so the dev-machine
     * and LAN origins can live in the {@code local} profile instead of shipping to production,
     * where — with credentials enabled — they let any page on the user's machine or anywhere on
     * their Wi-Fi read their signed-in data.
     *
     * <p>Bound, not {@code @Value}-injected: see {@link CorsProperties} for why a YAML sequence
     * cannot be read through a placeholder.
     */
    private final CorsProperties corsProperties;

    public SecurityConfig(CorsProperties corsProperties) {
        this.corsProperties = corsProperties;
    }

    @Bean
    SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            TokenAuthenticationHandler.BearerTokenAuthenticationEntryPoint authenticationEntryPoint,
            TokenAuthenticationHandler.BearerTokenAccessDeniedHandler accessDeniedHandler
    ) {

        return http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(Customizer.withDefaults())
                .sessionManagement(session ->
                        session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(AppConstants.PUBLIC_APIS).permitAll()
                        // Read-only browse surface. GET-scoped on purpose: the browse
                        // endpoints share their base paths with admin writes (rails) and
                        // user writes (reviews), so a method-agnostic matcher would open
                        // those too.
                        .requestMatchers(HttpMethod.GET, AppConstants.PUBLIC_GET_APIS).permitAll()
                        .anyRequest().authenticated()
                )
                .oauth2ResourceServer(oauth2 -> oauth2
                        .jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthenticationConverter()))
                        .authenticationEntryPoint(authenticationEntryPoint)
                        .accessDeniedHandler(accessDeniedHandler)
                )
                .build();
    }

    /**
     * Shouts at boot if any plain-HTTP origin is trusted for credentialed requests.
     *
     * <p>Splitting the dev origins into the {@code local} profile only helps if production is not
     * running that profile — and the WAR is started by {@code dbworldctl} on the Pi, a script that
     * lives outside this repository, so nothing here can prove which profile is active. A silent
     * misconfiguration would look exactly like a correct one while leaving the whole LAN trusted.
     *
     * <p>An {@code http://} origin combined with {@code allowCredentials} is the specific hazard:
     * it means a page the user did not fetch over TLS can read their signed-in data, and anyone on
     * the path can inject that page. Warn rather than fail, because this is legitimate on a dev
     * machine — the point is that it can never be quiet in a log someone is reading.
     */
    private void warnAboutDevOrigins() {
        List<String> insecure = corsProperties.allowedOriginPatterns().stream()
                .filter(p -> p.startsWith("http://"))
                .toList();
        if (!insecure.isEmpty()) {
            log.warn("CORS allows credentialed requests from PLAIN-HTTP origins {} — expected only "
                            + "on a dev machine. If this is production, `app.cors.allowed-origin-patterns` "
                            + "is wrong or the `local` profile is active.", insecure);
        }
    }

    @Bean
    JwtAuthenticationConverter jwtAuthenticationConverter() {

        JwtGrantedAuthoritiesConverter converter = new JwtGrantedAuthoritiesConverter();
        converter.setAuthoritiesClaimName("role");
        converter.setAuthorityPrefix(""); // keep only if using hasAuthority()

        JwtAuthenticationConverter jwtConverter = new JwtAuthenticationConverter();
        jwtConverter.setJwtGrantedAuthoritiesConverter(converter);

        return jwtConverter;
    }

    @Bean
    CorsConfigurationSource corsConfigurationSource() {

        warnAboutDevOrigins();

        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOriginPatterns(corsProperties.allowedOriginPatterns());
        config.setAllowedHeaders(List.of("*"));
        config.setAllowedMethods(List.of("*"));
        config.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);

        return source;
    }

    /**
     * Modern Spring Security 7 idiom — expose the AuthenticationManager directly.
     * The previous {@code AuthenticationManagerBuilder.getSharedObject(...)} dance
     * was the workaround for an older Spring Security version; with our custom
     * provider, a plain ProviderManager is simpler and removes the HttpSecurity
     * coupling.
     */
    @Bean
    AuthenticationManager authenticationManager(CustomAuthenticationProvider provider) {
        return new ProviderManager(provider);
    }
}
