package com.db.dbworld.admin.redis.dto;

import java.util.List;

public record RedisPageDto(
        List<RedisKeyDto> keys,
        int total,
        int page,
        int size,
        int totalPages
) {}
