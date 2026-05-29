package com.db.dbworld.admin.redis.controller;

import com.db.dbworld.admin.redis.dto.*;
import com.db.dbworld.admin.redis.service.RedisAdminService;
import com.db.dbworld.api.response.ApiResponse;
import com.db.dbworld.core.role.annotations.AdminAccess;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@Log4j2
@RestController
@RequestMapping("/api/admin/redis")
@RequiredArgsConstructor
public class RedisAdminController {

    private final RedisAdminService service;

    /* ── Server info ── */

    @AdminAccess
    @GetMapping("/info")
    public ApiResponse<RedisInfoDto> info() {
        return ApiResponse.success(service.getInfo());
    }

    /* ── Keys (paginated SCAN) ── */

    @AdminAccess
    @GetMapping("/keys")
    public ApiResponse<RedisPageDto> keys(
            @RequestParam(defaultValue = "*")  String pattern,
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return ApiResponse.success(service.getKeys(pattern, page, size));
    }

    /* ── Key value + TTL + type ── */

    @AdminAccess
    @GetMapping("/key")
    public ApiResponse<RedisKeyValueDto> getKey(@RequestParam String key) {
        return ApiResponse.success(service.getKeyValue(key));
    }

    /* ── Set (create or overwrite) ── */

    @AdminAccess
    @PostMapping("/key")
    public ApiResponse<Void> setKey(@RequestBody RedisSetRequest request) {
        service.setKey(request);
        return ApiResponse.success("Key set successfully");
    }

    /* ── Update value (preserve TTL) ── */

    @AdminAccess
    @PutMapping("/key")
    public ApiResponse<Void> updateKey(
            @RequestParam String key,
            @RequestBody Map<String, String> body
    ) {
        service.updateKey(key, body.get("value"));
        return ApiResponse.success("Key updated");
    }

    /* ── Update TTL only ── */

    @AdminAccess
    @PatchMapping("/key/ttl")
    public ApiResponse<Void> updateTtl(
            @RequestParam String key,
            @RequestParam(required = false) Long ttlSeconds
    ) {
        service.updateTtl(key, ttlSeconds);
        return ApiResponse.success("TTL updated");
    }

    /* ── Delete single key ── */

    @AdminAccess
    @DeleteMapping("/key")
    public ApiResponse<Void> deleteKey(@RequestParam String key) {
        service.deleteKey(key);
        return ApiResponse.success("Key deleted");
    }

    /* ── Bulk delete by key list ── */

    @AdminAccess
    @DeleteMapping("/keys")
    public ApiResponse<Map<String, Long>> deleteKeys(@RequestBody List<String> keys) {
        long count = service.deleteKeys(keys);
        return ApiResponse.success(Map.of("deleted", count));
    }

    /* ── Flush all keys matching pattern ── */

    @AdminAccess
    @DeleteMapping("/flush")
    public ApiResponse<Map<String, Long>> flush(
            @RequestParam(defaultValue = "*")     String pattern,
            @RequestParam(defaultValue = "false") boolean confirm
    ) {
        if (!confirm) {
            log.warn("Redis flush rejected: confirm=false pattern='{}'", pattern);
            throw new IllegalArgumentException("Set confirm=true to proceed with flush");
        }
        log.info("Admin Redis flush pattern='{}' confirmed", pattern);
        long count = service.flushByPattern(pattern);
        return ApiResponse.success(Map.of("deleted", count));
    }
}
