package com.db.dbworld.config;

import org.springdoc.core.models.GroupedOpenApi;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.client.WebSocketClient;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;

@Configuration
public class CoreBeansConfig {

    @Bean
    GroupedOpenApi api() {
        return GroupedOpenApi.builder()
                .group("dbworld-apis")
                .pathsToMatch("/api/**")
                .displayName("DB-WORLD Backend REST API")
                .build();
    }

    @Bean
    WebSocketClient webSocketClient() {
        return new StandardWebSocketClient();
    }
}
