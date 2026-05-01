package com.db.dbworld.helpers;

import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;

import java.util.function.Supplier;

@Log4j2
@Component
public class CacheLogger {

    @Autowired
    private CacheManager cacheManager;

    @Autowired(required = false)
    private RedisTemplate<String, Object> redisTemplate;

    public <T> T logCacheAccess(String cacheName, String key, Supplier<T> databaseSupplier) {
        Cache cache = cacheManager.getCache(cacheName);
        if (cache != null) {
            Cache.ValueWrapper wrapper = cache.get(key);
            if (wrapper != null) {
                log.debug("Data fetched from Redis cache [{}] with key: {}", cacheName, key);
                return (T) wrapper.get();
            }
        }

        log.debug("Data not found in cache, fetching from database for key: {}", key);
        T result = databaseSupplier.get();

        if (cache != null && result != null) {
            cache.put(key, result);
            log.debug("Data stored in Redis cache [{}] with key: {}", cacheName, key);
        }

        return result;
    }
}
