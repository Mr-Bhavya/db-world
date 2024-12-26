package com.db.dbworld.config;

import com.db.dbworld.payloads.dbcinema.DBCinemaRecordsDto;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.jsontype.impl.LaissezFaireSubTypeValidator;
import org.springframework.cache.interceptor.KeyGenerator;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext;
import org.springframework.data.redis.serializer.RedisSerializer;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.Duration;
import java.util.Arrays;

@Configuration
public class RedisCacheConfig {

    @Bean
    public RedisCacheManager cacheManager(RedisConnectionFactory redisConnectionFactory) {

        ObjectMapper objectMapper = new ObjectMapper();
        objectMapper.activateDefaultTyping(
                LaissezFaireSubTypeValidator.instance,
                ObjectMapper.DefaultTyping.NON_FINAL,
                JsonTypeInfo.As.PROPERTY
        );

        RedisCacheConfiguration cacheConfig = RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(Duration.ofHours(24)) // Set TTL for cache entries
                .disableCachingNullValues()
                .serializeKeysWith(RedisSerializationContext.SerializationPair.fromSerializer(RedisSerializer.string()))
                .serializeValuesWith(RedisSerializationContext.SerializationPair.fromSerializer(new GenericJackson2JsonRedisSerializer(objectMapper)));

        return RedisCacheManager.builder(redisConnectionFactory)
                .cacheDefaults(cacheConfig)
                .build();
    }

    @Bean
    public KeyGenerator customRedisKeyGenerator() {
        return (target, method, params)
                -> target.getClass().getSimpleName() + "::" + method.getName() + "::" + Arrays.toString(params);
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
                if(param instanceof DBCinemaRecordsDto){
                    recordId = ((DBCinemaRecordsDto) param).getRecordId();
                    break;
                }
                if(param instanceof Long){
                    recordId = (Long) param;
                    break;
                }
            }
            // Generate a key including the username, method name, and parameters
            return username + "::" + "addUsersDbCinemaData" + "::" + recordId;
        };
    }
}
