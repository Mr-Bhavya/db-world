package com.db.dbworld.admin.redis.dto;

public record RedisKeyValueDto(
        String key,
        String value,
        String type,
        long ttl
) {}
