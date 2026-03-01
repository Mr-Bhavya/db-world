package com.db.dbworld.config;

import com.db.dbworld.entities.dbcinema.stream.MediaFileInfoEntity;
import com.db.dbworld.payloads.dbcinema.stream.MediaFileInfo;
import org.modelmapper.ModelMapper;
import org.modelmapper.convention.MatchingStrategies;
import org.springdoc.core.models.GroupedOpenApi;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.client.WebSocketClient;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;

@Configuration
public class CoreBeansConfig {

    @Bean
    ModelMapper modelMapper() {

        ModelMapper mapper = new ModelMapper();

        // Recommended strict mode for production
        mapper.getConfiguration()
                .setMatchingStrategy(MatchingStrategies.STRICT)
                .setFieldMatchingEnabled(true)
                .setSkipNullEnabled(true);

        // Custom mapping
        mapper.typeMap(MediaFileInfoEntity.class, MediaFileInfo.class).addMappings(m ->
                        m.map(src -> src.getDbCinemaRecord().getId(), MediaFileInfo::setDbCinemaRecordId));

        return mapper;
    }

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
