package com.db.dbworld.admin.redis.dto;

public record RedisInfoDto(
        String version,
        long uptimeSeconds,
        long connectedClients,
        long usedMemoryBytes,
        long maxMemoryBytes,
        String usedMemoryHuman,
        String maxMemoryHuman,
        long totalKeys,
        long totalCommandsProcessed,
        long keyspaceHits,
        long keyspaceMisses,
        double hitRatePercent
) {}
