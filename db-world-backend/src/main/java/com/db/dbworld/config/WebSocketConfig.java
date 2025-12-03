package com.db.dbworld.config;

import com.db.dbworld.handler.ApplicationLogsHandler;
import com.db.dbworld.handler.MirrorStatusHandler;
import com.db.dbworld.handler.UserCinemaActivityHandler;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.Message;
import org.springframework.security.authorization.AuthorizationManager;
import org.springframework.security.config.annotation.web.socket.EnableWebSocketSecurity;
import org.springframework.security.messaging.access.intercept.MessageMatcherDelegatingAuthorizationManager;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
@EnableWebSocketSecurity
public class WebSocketConfig implements WebSocketConfigurer {

    @Bean
    AuthorizationManager<Message<?>> messageAuthorizationManager(MessageMatcherDelegatingAuthorizationManager.Builder messages) {
        messages.simpDestMatchers("/ws/**").hasAnyAuthority("VIEWER")
                .anyMessage().authenticated();
        ;
        return messages.build();
    }

    private final MirrorStatusHandler mirrorStatusHandler;
    private final ApplicationLogsHandler applicationLogsHandler;
    private final UserCinemaActivityHandler userCinemaActivityHandler;

    public WebSocketConfig(MirrorStatusHandler mirrorStatusHandler, ApplicationLogsHandler applicationLogsHandler, UserCinemaActivityHandler userCinemaActivityHandler) {
        this.mirrorStatusHandler = mirrorStatusHandler;
        this.applicationLogsHandler = applicationLogsHandler;
        this.userCinemaActivityHandler = userCinemaActivityHandler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(mirrorStatusHandler, "/ws/status")
                .setAllowedOrigins("*");

        registry.addHandler(applicationLogsHandler, "/ws/application-logs")
                .setAllowedOrigins("*");

        registry.addHandler(userCinemaActivityHandler, "/ws/user-cinema-activity")
                .setAllowedOrigins("*");
    }

}

