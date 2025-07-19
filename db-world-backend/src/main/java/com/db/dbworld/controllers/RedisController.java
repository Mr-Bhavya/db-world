package com.db.dbworld.controllers;

import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.util.Collections;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/redis")
@RequiredArgsConstructor
public class RedisController {

    private final StringRedisTemplate redisTemplate;
    private static final long MAX_KEYS_LIMIT = 1000;
    private static final long MAX_TTL_SECONDS = 365 * 24 * 60 * 60; // 1 year

    @GetMapping("/keys")
    public ResponseEntity<Set<String>> getKeys(
            @RequestParam(defaultValue = "*") String pattern,
            @RequestParam(defaultValue = "0") long offset,
            @RequestParam(defaultValue = "100") long limit) {

        if (limit > MAX_KEYS_LIMIT) {
            limit = MAX_KEYS_LIMIT;
        }

        try {
            Set<String> keys = redisTemplate.keys(pattern);
            if (keys == null) {
                return ResponseEntity.ok(Collections.emptySet());
            }

            return ResponseEntity.ok(keys.stream()
                    .skip(offset)
                    .limit(limit)
                    .collect(Collectors.toSet()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    @GetMapping("/get")
    public ResponseEntity<String> getValue(@RequestParam String key) {
        try {
            ValueOperations<String, String> ops = redisTemplate.opsForValue();
            String value = ops.get(key);
            return value != null
                    ? ResponseEntity.ok(value)
                    : ResponseEntity.notFound().build();
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    @PostMapping("/set")
    public ResponseEntity<String> setValue(
            @RequestParam String key,
            @RequestParam String value,
            @RequestParam(required = false) Long ttlSeconds) {

        if (key == null || key.isEmpty()) {
            return ResponseEntity.badRequest().body("Key cannot be empty");
        }

        if (ttlSeconds != null && (ttlSeconds < 0 || ttlSeconds > MAX_TTL_SECONDS)) {
            return ResponseEntity.badRequest().body("Invalid TTL value");
        }

        try {
            ValueOperations<String, String> ops = redisTemplate.opsForValue();
            if (ttlSeconds != null) {
                ops.set(key, value, Duration.ofSeconds(ttlSeconds));
            } else {
                ops.set(key, value);
            }
            return ResponseEntity.ok("Key set successfully");
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body("Failed to set key");
        }
    }

    @PutMapping("/update")
    public ResponseEntity<String> updateValue(
            @RequestParam String key,
            @RequestParam String newValue) {

        try {
            if (!redisTemplate.hasKey(key)) {
                return ResponseEntity.notFound().build();
            }

            redisTemplate.opsForValue().set(key, newValue);
            return ResponseEntity.ok("Key updated successfully");
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body("Failed to update key");
        }
    }

    @DeleteMapping("/delete")
    public ResponseEntity<String> deleteKey(@RequestParam String key) {
        try {
            Boolean deleted = redisTemplate.delete(key);
            return deleted != null && deleted
                    ? ResponseEntity.ok("Key deleted successfully")
                    : ResponseEntity.notFound().build();
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body("Failed to delete key");
        }
    }

    @DeleteMapping("/delete-all")
    public ResponseEntity<String> deleteAllKeys(
            @RequestParam(defaultValue = "*") String pattern,
            @RequestParam(defaultValue = "false") boolean confirm) {

        if (!confirm) {
            return ResponseEntity.badRequest()
                    .body("Confirmation required. Set confirm=true to proceed");
        }

        try {
            Set<String> keys = redisTemplate.keys(pattern);
            if (keys == null || keys.isEmpty()) {
                return ResponseEntity.ok("No keys matched the pattern");
            }

            if (keys.size() > MAX_KEYS_LIMIT) {
                return ResponseEntity.badRequest()
                        .body("Too many keys to delete. Please narrow your pattern or increase MAX_KEYS_LIMIT");
            }

            redisTemplate.delete(keys);
            return ResponseEntity.ok("Deleted " + keys.size() + " keys");
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body("Failed to delete keys");
        }
    }

    @DeleteMapping("/delete/batch")
    public ResponseEntity<String> deleteSelectedKeys(@RequestBody Set<String> keys) {
        if (keys == null || keys.isEmpty()) {
            return ResponseEntity.badRequest().body("Key list cannot be empty");
        }

        try {
            Long deletedCount = redisTemplate.delete(keys);
            return ResponseEntity.ok("Deleted " + deletedCount + " keys successfully.");
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body("Failed to delete selected keys");
        }
    }
}
