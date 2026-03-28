package com.db.dbworld.app.cinema.interaction.cache;

import com.db.dbworld.cinema.interaction.dto.InteractionDto;
import com.db.dbworld.cinema.interaction.enums.InteractionType;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class InteractionCacheService {

    private final RedisTemplate<String, Object> redisTemplate;

    private static final Duration TTL = Duration.ofHours(6);

    private String key(Long userId) {
        return "interaction:" + userId;
    }

    private String field(Long recordId) {
        return String.valueOf(recordId);
    }

    /* =========================
       GET (BATCH) - HASH
       ========================= */

    public Map<Long, InteractionDto> getBatch(Long userId, List<Long> recordIds) {

        String key = key(userId);

        List<Object> values = redisTemplate.opsForHash()
                .multiGet(key, Collections.singleton(recordIds.stream().map(this::field).toList()));

        Map<Long, InteractionDto> result = new HashMap<>();

        for (int i = 0; i < recordIds.size(); i++) {
            InteractionDto dto = (InteractionDto) values.get(i);
            if (dto != null) {
                result.put(recordIds.get(i), dto);
            }
        }

        return result;
    }

    /* =========================
       PUT (BATCH) - HASH
       ========================= */

    public void putBatch(Long userId, Map<Long, InteractionDto> map) {

        String key = key(userId);

        Map<String, InteractionDto> redisMap = new HashMap<>();

        map.forEach((recordId, dto) ->
                redisMap.put(field(recordId), dto)
        );

        redisTemplate.opsForHash().putAll(key, redisMap);

        // apply TTL on whole hash
        redisTemplate.expire(key, TTL);
    }

    /* =========================
       UPDATE SINGLE FIELD
       ========================= */

    public void updateField(
            Long userId,
            Long recordId,
            InteractionType type,
            boolean value,
            Integer progress
    ) {

        String key = key(userId);
        String field = field(recordId);

        InteractionDto dto = (InteractionDto) redisTemplate.opsForHash().get(key, field);

        if (dto == null) {
            dto = new InteractionDto(
                    recordId,
                    false,
                    false,
                    false,
                    false,
                    null
            );
        }

        switch (type) {
            case LIKE -> dto.setLiked(value);
            case LOVE -> dto.setLoved(value);
            case WATCHLIST -> dto.setWatchlisted(value);
            case WATCHED -> dto.setWatched(value);
            case PROGRESS -> dto.setProgress(progress);
        }

        redisTemplate.opsForHash().put(key, field, dto);

        // refresh TTL (optional but recommended)
        redisTemplate.expire(key, TTL);
    }
}