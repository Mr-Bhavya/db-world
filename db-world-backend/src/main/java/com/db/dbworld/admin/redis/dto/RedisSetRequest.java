package com.db.dbworld.admin.redis.dto;

public record RedisSetRequest(
        String key,
        String value,
        Long ttlSeconds
) {}
