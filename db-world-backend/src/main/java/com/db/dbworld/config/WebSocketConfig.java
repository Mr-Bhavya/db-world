package com.db.dbworld.config;

import com.db.dbworld.handler.ApplicationLogsHandler;
import com.db.dbworld.logging.LogWebSocketHandler;
import com.db.dbworld.handler.MirrorStatusHandler;
import com.db.dbworld.handler.UserCinemaActivityHandler;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;
import org.springframework.web.socket.server.standard.ServletServerContainerFactoryBean;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final MirrorStatusHandler mirrorStatusHandler;
    private final ApplicationLogsHandler applicationLogsHandler;
    private final UserCinemaActivityHandler userCinemaActivityHandler;
    private final LogWebSocketHandler logWebSocketHandler;

    public WebSocketConfig(
            MirrorStatusHandler mirrorStatusHandler,
            ApplicationLogsHandler applicationLogsHandler,
            UserCinemaActivityHandler userCinemaActivityHandler,
            LogWebSocketHandler logWebSocketHandler) {

        this.mirrorStatusHandler = mirrorStatusHandler;
        this.applicationLogsHandler = applicationLogsHandler;
        this.userCinemaActivityHandler = userCinemaActivityHandler;
        this.logWebSocketHandler = logWebSocketHandler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(mirrorStatusHandler, "/ws/status")
                .setAllowedOriginPatterns("*");

        registry.addHandler(applicationLogsHandler, "/ws/application-logs")
                .setAllowedOriginPatterns("*");

        registry.addHandler(userCinemaActivityHandler, "/ws/user-cinema-activity")
                .setAllowedOriginPatterns("*");

        registry.addHandler(logWebSocketHandler, "/ws/logs")
                .setAllowedOriginPatterns("*");
    }

    // Configure WebSocket container settings
    @Bean
    public ServletServerContainerFactoryBean createWebSocketContainer() {
        ServletServerContainerFactoryBean container = new ServletServerContainerFactoryBean();
        container.setMaxTextMessageBufferSize(1024 * 1024); // 1MB
        container.setMaxBinaryMessageBufferSize(1024 * 1024); // 1MB
        container.setMaxSessionIdleTimeout(300000L); // 5 minutes
        container.setAsyncSendTimeout(60000L); // 60 seconds
        return container;
    }

    @Bean
    @Order(Ordered.HIGHEST_PRECEDENCE)
    public SecurityFilterChain webSocketSecurityFilterChain(HttpSecurity http) throws Exception {
        http.securityMatcher("/ws/**")
                .csrf(AbstractHttpConfigurer::disable)
                .authorizeHttpRequests(auth -> auth
                        .anyRequest().permitAll()
                );

        return http.build();
    }
}