package com.db.dbworld.app.cinema.rail.cache;

import com.db.dbworld.app.cinema.rail.dto.RailPageDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.*;
import java.util.stream.Collectors;

@Log4j2
@Service
@RequiredArgsConstructor
public class RailCacheService {

    private final RedisTemplate<String, Object> redisTemplate;

    private static final Duration TTL = Duration.ofMinutes(3);
    private static final Duration INDEX_TTL = Duration.ofMinutes(10);

    /* =========================================================
       KEY BUILDERS
    ========================================================= */

    private String railKey(Long railId, int page, int size) {
        return "rail:" + railId + ":" + page + ":" + size;
    }

    private String recordIndexKey(Long recordId) {
        return "record:" + recordId;
    }

    /* =========================================================
       READ
    ========================================================= */

    public RailPageDto get(Long railId, int page, int size) {
        Object value = redisTemplate.opsForValue().get(railKey(railId, page, size));
        return value instanceof RailPageDto dto ? dto : null;
    }

    /* =========================================================
       WRITE (WITH INDEX)
    ========================================================= */

    public void put(Long railId,
                    int page,
                    int size,
                    RailPageDto dto,
                    List<Long> recordIds) {

        String railKey = railKey(railId, page, size);

        // 1. Store main cache
        redisTemplate.opsForValue().set(railKey, dto, TTL);

        if (recordIds == null || recordIds.isEmpty()) return;

        // 2. Index mapping (record → rail keys)
        redisTemplate.executePipelined(
                (org.springframework.data.redis.core.RedisCallback<Object>) connection -> {

                    final var keySerializer = redisTemplate.getStringSerializer();

                    final byte[] railKeyBytes = keySerializer.serialize(railKey);

                    for (Long recordId : recordIds) {

                        final byte[] indexKeyBytes =
                                keySerializer.serialize(recordIndexKey(recordId));

                        connection.setCommands().sAdd(indexKeyBytes, railKeyBytes);
                        connection.keyCommands().expire(indexKeyBytes, INDEX_TTL.toSeconds());
                    }

                    return null;
                }
        );
    }

    /* =========================================================
       TARGETED EVICTION
    ========================================================= */

    public void evictByRecord(Long recordId) {

        String indexKey = recordIndexKey(recordId);

        Set<Object> members = redisTemplate.opsForSet().members(indexKey);

        if (members == null || members.isEmpty()) return;

        // Convert safely
        Set<String> keys = members.stream()
                .filter(Objects::nonNull)
                .map(Object::toString)
                .collect(Collectors.toSet());

        // Batch delete (better than loop)
        redisTemplate.delete(keys);

        // cleanup index
        redisTemplate.delete(indexKey);

        log.info("Rail cache invalidated; reason=recordChanged; recordId={}; railKeysEvicted={}",
                recordId, keys.size());
    }

    /* =========================================================
       FULL EVICTION (FALLBACK)
    ========================================================= */

    public void evictAll() {

        Set<String> keys = redisTemplate.keys("rail:*");

        if (keys == null || keys.isEmpty()) {
            log.info("Rail cache invalidated; reason=evictAll; railKeysEvicted=0");
            return;
        }

        redisTemplate.delete(keys);
        log.info("Rail cache invalidated; reason=evictAll; railKeysEvicted={}", keys.size());
    }
}