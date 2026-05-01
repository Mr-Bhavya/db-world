package com.db.dbworld.admin.redis.service;

import com.db.dbworld.admin.redis.dto.*;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.data.redis.connection.DataType;
import org.springframework.data.redis.core.Cursor;
import org.springframework.data.redis.core.RedisCallback;
import org.springframework.data.redis.core.ScanOptions;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Log4j2
public class RedisAdminService {

    private final StringRedisTemplate template;

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final int    MAX_SCAN_KEYS   = 2000;

    /* ── Server info ──────────────────────────────────────────── */

    public RedisInfoDto getInfo() {
        Properties info = template.execute(
                (RedisCallback<Properties>) conn -> conn.serverCommands().info());
        Long totalKeys = template.execute(
                (RedisCallback<Long>) conn -> conn.serverCommands().dbSize());

        if (info == null) {
            return new RedisInfoDto("N/A", 0, 0, 0, 0, "N/A", "N/A",
                    totalKeys != null ? totalKeys : 0, 0, 0, 0, 0.0);
        }

        long usedMemory = parseLong(info.getProperty("used_memory"), 0);
        long maxMemory  = parseLong(info.getProperty("maxmemory"), 0);
        long hits       = parseLong(info.getProperty("keyspace_hits"), 0);
        long misses     = parseLong(info.getProperty("keyspace_misses"), 0);
        double hitRate  = (hits + misses) == 0 ? 0.0
                : Math.round((double) hits / (hits + misses) * 1000.0) / 10.0;

        return new RedisInfoDto(
                info.getProperty("redis_version", "N/A"),
                parseLong(info.getProperty("uptime_in_seconds"), 0),
                parseLong(info.getProperty("connected_clients"), 0),
                usedMemory,
                maxMemory,
                info.getProperty("used_memory_human", "N/A"),
                maxMemory == 0 ? "unlimited" : info.getProperty("maxmemory_human", "N/A"),
                totalKeys != null ? totalKeys : 0,
                parseLong(info.getProperty("total_commands_processed"), 0),
                hits,
                misses,
                hitRate
        );
    }

    /* ── Keys (paginated SCAN) ────────────────────────────────── */

    public RedisPageDto getKeys(String pattern, int page, int size) {
        List<String> allKeys = scanKeys(pattern, MAX_SCAN_KEYS);
        Collections.sort(allKeys);

        int total      = allKeys.size();
        int from       = Math.min(page * size, total);
        int to         = Math.min(from + size, total);
        int totalPages = size == 0 ? 0 : (int) Math.ceil((double) total / size);

        List<RedisKeyDto> pageKeys = allKeys.subList(from, to).stream()
                .map(this::toKeyDto)
                .collect(Collectors.toList());

        return new RedisPageDto(pageKeys, total, page, size, totalPages);
    }

    /* ── Key value ────────────────────────────────────────────── */

    public RedisKeyValueDto getKeyValue(String key) {
        DataType type = template.type(key);
        Long ttl      = template.getExpire(key, TimeUnit.SECONDS);
        String value  = readValue(key, type);
        return new RedisKeyValueDto(
                key,
                value,
                type != null ? type.code() : "none",
                ttl != null ? ttl : -1
        );
    }

    /* ── Set key ──────────────────────────────────────────────── */

    public void setKey(RedisSetRequest req) {
        if (req.ttlSeconds() != null && req.ttlSeconds() > 0) {
            template.opsForValue().set(req.key(), req.value(), Duration.ofSeconds(req.ttlSeconds()));
        } else {
            template.opsForValue().set(req.key(), req.value());
        }
    }

    /* ── Update value (preserve TTL) ─────────────────────────── */

    public void updateKey(String key, String newValue) {
        if (Boolean.FALSE.equals(template.hasKey(key))) {
            throw new EntityNotFoundException("Key not found: " + key);
        }
        Long existing = template.getExpire(key, TimeUnit.SECONDS);
        if (existing != null && existing > 0) {
            template.opsForValue().set(key, newValue, Duration.ofSeconds(existing));
        } else {
            template.opsForValue().set(key, newValue);
        }
    }

    /* ── Update TTL ───────────────────────────────────────────── */

    public void updateTtl(String key, Long ttlSeconds) {
        if (Boolean.FALSE.equals(template.hasKey(key))) {
            throw new EntityNotFoundException("Key not found: " + key);
        }
        if (ttlSeconds == null || ttlSeconds <= 0) {
            template.persist(key);
        } else {
            template.expire(key, Duration.ofSeconds(ttlSeconds));
        }
    }

    /* ── Delete ───────────────────────────────────────────────── */

    public boolean deleteKey(String key) {
        return Boolean.TRUE.equals(template.delete(key));
    }

    public long deleteKeys(List<String> keys) {
        Long count = template.delete(keys);
        return count != null ? count : 0;
    }

    public long flushByPattern(String pattern) {
        List<String> keys = scanKeys(pattern, MAX_SCAN_KEYS);
        if (keys.isEmpty()) return 0;
        Long deleted = template.delete(keys);
        log.info("Flushed {} keys matching pattern '{}'", deleted, pattern);
        return deleted != null ? deleted : 0;
    }

    /* ── Internals ────────────────────────────────────────────── */

    private List<String> scanKeys(String pattern, int maxCount) {
        List<String> result = template.execute((RedisCallback<List<String>>) connection -> {
            List<String> collected = new ArrayList<>();
            try (Cursor<byte[]> cursor = connection.keyCommands()
                    .scan(ScanOptions.scanOptions().match(pattern).count(100).build())) {
                while (cursor.hasNext() && collected.size() < maxCount) {
                    collected.add(new String(cursor.next(), StandardCharsets.UTF_8));
                }
            } catch (Exception e) {
                log.error("SCAN error for pattern '{}': {}", pattern, e.getMessage());
            }
            return collected;
        });
        return result != null ? result : Collections.emptyList();
    }

    private RedisKeyDto toKeyDto(String key) {
        try {
            DataType type = template.type(key);
            Long ttl      = template.getExpire(key, TimeUnit.SECONDS);
            return new RedisKeyDto(key, type != null ? type.code() : "none", ttl != null ? ttl : -1);
        } catch (Exception e) {
            return new RedisKeyDto(key, "none", -1);
        }
    }

    private String readValue(String key, DataType type) {
        if (type == null || type == DataType.NONE) return null;
        try {
            return switch (type) {
                case STRING -> template.opsForValue().get(key);
                case HASH   -> toJson(template.opsForHash().entries(key));
                case LIST   -> toJson(template.opsForList().range(key, 0, 99));
                case SET    -> toJson(template.opsForSet().members(key));
                case ZSET   -> toJson(template.opsForZSet().rangeWithScores(key, 0, 99));
                default     -> "[" + type.code() + " — not displayable]";
            };
        } catch (Exception e) {
            log.warn("Failed to read value for key '{}': {}", key, e.getMessage());
            return "[error reading value]";
        }
    }

    private static String toJson(Object obj) {
        try {
            return MAPPER.writerWithDefaultPrettyPrinter().writeValueAsString(obj);
        } catch (JsonProcessingException e) {
            return String.valueOf(obj);
        }
    }

    private static long parseLong(String s, long def) {
        if (s == null || s.isBlank()) return def;
        try { return Long.parseLong(s.trim()); }
        catch (NumberFormatException e) { return def; }
    }
}
