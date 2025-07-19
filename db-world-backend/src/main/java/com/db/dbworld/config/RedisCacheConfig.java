package com.db.dbworld.config;

import com.db.dbworld.entities.dbcinema.DBCinemaRecordsEntity;
import com.db.dbworld.payloads.MirrorStatus;
import com.db.dbworld.payloads.RequestPayloads;
import com.db.dbworld.payloads.dbcinema.DBCinemaRecordsDto;
import com.db.dbworld.services.UserService;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.jsontype.impl.LaissezFaireSubTypeValidator;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.interceptor.KeyGenerator;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext;
import org.springframework.data.redis.serializer.RedisSerializer;
import org.springframework.data.redis.serializer.StringRedisSerializer;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Arrays;
import java.util.Map;

@Configuration
public class RedisCacheConfig {

    @Bean
    public LettuceConnectionFactory redisConnectionFactory() {
        return new LettuceConnectionFactory();
    }

    @Autowired
    private UserService userService;

    @Bean
    public RedisCacheManager cacheManager(RedisConnectionFactory redisConnectionFactory) {

        ObjectMapper objectMapper = new ObjectMapper();
        objectMapper.activateDefaultTyping(
                LaissezFaireSubTypeValidator.instance,
                ObjectMapper.DefaultTyping.NON_FINAL,
                JsonTypeInfo.As.PROPERTY
        );

        RedisCacheConfiguration defaultConfig = RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(Duration.ofHours(24)) // Set TTL for cache entries
                .disableCachingNullValues()
                .serializeKeysWith(RedisSerializationContext.SerializationPair.fromSerializer(RedisSerializer.string()))
                .serializeValuesWith(RedisSerializationContext.SerializationPair.fromSerializer(new GenericJackson2JsonRedisSerializer(objectMapper)));

        Map<String, RedisCacheConfiguration> cacheConfigurations = Map.of(
                "DB-Cinema", defaultConfig.entryTtl(Duration.ofDays(1)),
                "DB-Cinema-Short", defaultConfig.entryTtl(Duration.ofMinutes(30)),
                "DB-Cinema-Long", defaultConfig.entryTtl(Duration.ofDays(7))
        );

        return RedisCacheManager.builder(redisConnectionFactory())
                .cacheDefaults(defaultConfig)
                .withInitialCacheConfigurations(cacheConfigurations)
                .transactionAware()
                .build();
    }

    @Bean
    public RedisTemplate<String, Object> redisTemplate(RedisConnectionFactory connectionFactory) {
        RedisTemplate<String, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(connectionFactory);

        // Use String serializer for keys
        template.setKeySerializer(new StringRedisSerializer());
        template.setHashKeySerializer(new StringRedisSerializer());

        // Use JSON serializer for values
        GenericJackson2JsonRedisSerializer serializer = new GenericJackson2JsonRedisSerializer();
        template.setValueSerializer(serializer);
        template.setHashValueSerializer(serializer);

        template.afterPropertiesSet();
        return template;
    }

    @Bean
    public KeyGenerator customRedisKeyGenerator() {
        return (target, method, params)
                -> target.getClass().getSimpleName() + "::" + method.getName() + "::" + Arrays.toString(params);
    }

    @Bean
    public KeyGenerator customKeyGenerator() {
        return (target, method, params) -> {
            StringBuilder key = new StringBuilder();
            key.append(target.getClass().getSimpleName());
            key.append(":");
            key.append(method.getName());
            for (Object param : params) {
                if (param != null) {
                    key.append(":");
                    if (param instanceof DBCinemaRecordsEntity) {
                        key.append(((DBCinemaRecordsEntity) param).getId());
                    } else if (param instanceof RequestPayloads.AddRecord) {
                        key.append(((RequestPayloads.AddRecord) param).getTmdbId());
                    } else {
                        key.append(param);
                    }
                }
            }
            return key.toString();
        };
    }

    @Bean
    public KeyGenerator customRedisUserKeyGenerator() {
        return (target, method, params) -> {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            String username = (authentication != null && authentication.isAuthenticated())
                    ? authentication.getName()
                    : "anonymous";
            // Generate a key including the username, method name, and parameters
            return username + "::" + target.getClass().getSimpleName() + "::" + method.getName() + "::" + Arrays.toString(params);
        };
    }

    @Bean
    public KeyGenerator addUsersDbCinemaDataKey() {
        return (target, method, params) -> {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            String username = (authentication != null && authentication.isAuthenticated())
                    ? authentication.getName()
                    : "anonymous";

            Long recordId = null;
            for (Object param : params) {
                if (param instanceof DBCinemaRecordsDto) {
                    recordId = ((DBCinemaRecordsDto) param).getRecordId();
                    break;
                }
                if (param instanceof Long) {
                    recordId = (Long) param;
                    break;
                }
            }
            // Generate a key including the username, method name, and parameters
            return username + "::" + "addUsersDbCinemaData" + "::" + recordId;
        };
    }

    //    @Component("userAwareCacheKeyGenerator")
    @Bean
    public KeyGenerator userAwareCacheKeyGenerator() {
        return (target, method, params) -> {
            Long userId = userService.getUserIdFromToken();
            StringBuilder key = new StringBuilder();
            key.append(target.getClass().getSimpleName());
            key.append(":");
            key.append(method.getName());
            for (Object param : params) {
                if (param != null) {
                    key.append(":");
                    key.append(param.toString());
                }
            }
            key.append(":user:").append(userId);
            System.out.println(key);
            return key.toString();
        };
    }
}
