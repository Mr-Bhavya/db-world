package com.db.dbworld.admin.redis.dto;

public record RedisKeyDto(
        String key,
        String type,
        long ttl
) {}
