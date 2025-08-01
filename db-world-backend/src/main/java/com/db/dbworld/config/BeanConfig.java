package com.db.dbworld.config;

import com.db.dbworld.payloads.dbcinema.stream.PathAdapter;
import com.db.dbworld.utils.DbWorldConstants;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.google.gson.*;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OneToOne;
import org.jasypt.encryption.StringEncryptor;
import org.jasypt.encryption.pbe.PooledPBEStringEncryptor;
import org.jasypt.encryption.pbe.config.SimpleStringPBEConfig;
import org.modelmapper.ModelMapper;
import org.springdoc.core.models.GroupedOpenApi;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.http.converter.json.GsonHttpMessageConverter;
import org.springframework.integration.dsl.IntegrationFlow;
import org.springframework.integration.file.FileReadingMessageSource;
import org.springframework.integration.file.dsl.Files;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.reactive.socket.client.ReactorNettyWebSocketClient;
import org.springframework.web.socket.client.WebSocketClient;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;

import java.io.File;
import java.nio.file.Path;
import java.time.LocalDateTime;

@Configuration
public class BeanConfig {

    @Autowired
    private Environment environment;

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public ModelMapper modelMapper() {
        return new ModelMapper();
    }

    @Bean("jasyptStringEncryptor")
    public StringEncryptor stringEncryptor() {
        PooledPBEStringEncryptor encryptor = new PooledPBEStringEncryptor();
        SimpleStringPBEConfig config = new SimpleStringPBEConfig();
        config.setPassword(environment.getProperty("jasypt.encryptor.password"));
        config.setAlgorithm(DbWorldConstants.KEY_FACTORY_ALGORITHM);
        config.setKeyObtentionIterations("1000");
        config.setPoolSize("4");
        config.setProviderName("DB-WORLD");
        config.setSaltGeneratorClassName("org.jasypt.salt.RandomSaltGenerator");
        config.setIvGeneratorClassName("org.jasypt.iv.RandomIvGenerator");
        config.setStringOutputType("base64");
        encryptor.setConfig(config);
        return encryptor;
    }

    @Bean
    public IntegrationFlow fileIntegrationFlow() {
        return IntegrationFlow
                .from(Files.inboundAdapter(new File(DbWorldConstants.INTEGRATION_FOLDER_PATH))
                        .preventDuplicates(true)
                        .useWatchService(true) // Real-time detection
                        .watchEvents(FileReadingMessageSource.WatchEventType.CREATE,
                                FileReadingMessageSource.WatchEventType.MODIFY,
                                FileReadingMessageSource.WatchEventType.DELETE)
                        .autoCreateDirectory(true)
                )
                .handle("mediaFileHandler", "processFile")
                .get();
    }

    @Bean
    public RestTemplate restTemplate() {
        return new RestTemplate();
    }

    @Bean
    public Gson gson() {
        return new GsonBuilder().setExclusionStrategies(new ExclusionStrategy() {
                    @Override
                    public boolean shouldSkipField(FieldAttributes fieldAttributes) {
                        return fieldAttributes.getAnnotation(ManyToOne.class) != null ||
                                fieldAttributes.getAnnotation(OneToOne.class) != null ||
                                fieldAttributes.getAnnotation(ManyToMany.class) != null ||
                                fieldAttributes.getAnnotation(OneToMany.class) != null;
                    }

                    @Override
                    public boolean shouldSkipClass(Class<?> aClass) {
                        return false;
                    }
                })
                .registerTypeAdapter(Path.class, new PathAdapter())
                .registerTypeAdapter(LocalDateTime.class, (JsonSerializer<LocalDateTime>) (src, type, jsonSerializationContext) -> new JsonPrimitive(src.toString()))
                .serializeNulls().setPrettyPrinting().create();
    }

    @Bean
    public GsonHttpMessageConverter gsonHttpMessageConverter(Gson gson) {
        GsonHttpMessageConverter converter = new GsonHttpMessageConverter();
        converter.setGson(gson);
        return converter;
    }

    @Bean
    public GroupedOpenApi api() {
        return GroupedOpenApi.builder()
                .group("dbworld-apis")
                .pathsToMatch("/api/**")
                .displayName("DB-WORLD Backend REST API")
                .build();
    }

    @Bean
    public ObjectMapper objectMapper() {
        ObjectMapper mapper = new ObjectMapper();
        mapper.registerModule(new JavaTimeModule());
        // Prevent serialization of dates as timestamps
        mapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        return mapper;
    }

    @Bean
    public WebSocketClient webSocketClient() {
        return new StandardWebSocketClient();
    }

}
