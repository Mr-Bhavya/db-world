package com.db.dbworld.config;

import com.fasterxml.jackson.annotation.JsonInclude;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.serializer.GenericJacksonJsonRedisSerializer;
import org.springframework.data.redis.serializer.StringRedisSerializer;

@Configuration
public class RedisConfig {

    @Bean
    public RedisTemplate<String, Object> redisTemplate(
            RedisConnectionFactory connectionFactory
    ) {

        RedisTemplate<String, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(connectionFactory);

        // Spring Data Redis 4's builder is the Jackson 3 idiom: customize the
        // underlying JsonMapper builder, then turn on default typing for
        // polymorphic round-trips. "Unsafe" here just means LaissezFaire — fine
        // for a Redis cache we fully own (no untrusted producers).
        GenericJacksonJsonRedisSerializer serializer = GenericJacksonJsonRedisSerializer.builder()
                .customize(b -> b.changeDefaultPropertyInclusion(
                        v -> v.withValueInclusion(JsonInclude.Include.NON_NULL)))
                .enableUnsafeDefaultTyping()
                .build();

        StringRedisSerializer keySerializer = new StringRedisSerializer();

        template.setKeySerializer(keySerializer);
        template.setValueSerializer(serializer);
        template.setHashKeySerializer(keySerializer);
        template.setHashValueSerializer(serializer);

        template.afterPropertiesSet();
        return template;
    }
}
