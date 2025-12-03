package com.db.dbworld.config;

import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.util.*;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.resource.*;

import java.io.IOException;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.regex.Pattern;

/**
 * Fixed Single Page Application Configuration - JAR/WAR deployment compatible
 */
@Log4j2
@Configuration
public class SinglePageAppConfig implements WebMvcConfigurer {

    @Value("${app.static.cache.max-age:31536000}")
    private long maxAgeSeconds;

    @Value("${app.static.cache.public-resources:true}")
    private boolean cachePublicResources;

    @Value("${app.static.monitoring.enabled:false}")
    private boolean monitoringEnabled;

    // Static file extensions that should be handled
    private static final Set<String> STATIC_EXTENSIONS = Set.of(
            // Web assets
            "html", "htm", "xhtml",
            // Scripts
            "js", "mjs", "cjs",
            // Styles
            "css", "scss", "sass", "less",
            // Images
            "png", "jpg", "jpeg", "gif", "svg", "ico", "webp", "avif", "bmp", "tiff",
            // Fonts
            "woff", "woff2", "ttf", "eot", "otf",
            // Media
            "mp4", "webm", "ogg", "mp3", "wav", "flac", "aac",
            // Data files
            "json", "xml", "csv", "txt", "pdf", "zip", "rar", "7z",
            "doc", "docx", "xls", "xlsx", "ppt", "pptx",
            // Application files
            "webmanifest", "appcache", "map", "wasm"
    );

    // API path patterns that should NOT be handled as static resources
    private static final String[] API_PATH_PATTERNS = {
            "/api/**",
            "/actuator/**",
            "/admin/**",
            "/ws/**",
            "/websocket/**",
            "/graphql/**",
            "/graphiql/**",
            "/swagger-ui/**",
            "/v3/api-docs/**",
            "/webjars/**",
            "/error"
    };

    // Metrics
    private final AtomicInteger staticServed = new AtomicInteger(0);
    private final AtomicInteger indexServed = new AtomicInteger(0);
    private final AtomicInteger apiRequestsIgnored = new AtomicInteger(0);

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        log.info("Configuring static resource handler for JAR deployment");

        // Special handling for favicon.ico to avoid conflicts
        registry.addResourceHandler("/favicon.ico")
                .addResourceLocations("classpath:/public/")
                .setCacheControl(CacheControl.maxAge(365, TimeUnit.DAYS));

        // Main static resource handler
        registry.addResourceHandler("/**")
                .addResourceLocations("classpath:/public/")
                .setCacheControl(createCacheControl())
                .resourceChain(true) // Keep resource chain for caching
                .addResolver(new FixedPushStateResourceResolver());

        log.info("Static resource handler configured with max-age: {} seconds", maxAgeSeconds);
        log.info("Static extensions registered: {}", STATIC_EXTENSIONS);
    }

    /**
     * Creates CacheControl with appropriate settings
     */
    private CacheControl createCacheControl() {
        CacheControl cacheControl = CacheControl.maxAge(maxAgeSeconds, TimeUnit.SECONDS)
                .mustRevalidate()
                .noTransform();

        if (cachePublicResources) {
            cacheControl = cacheControl.cachePublic();
        } else {
            cacheControl = cacheControl.cachePrivate();
        }

        return cacheControl;
    }

    /**
     * Fixed resource resolver - JAR/WAR deployment compatible
     */
    private class FixedPushStateResourceResolver implements ResourceResolver {
        private final Resource indexResource = new ClassPathResource("/public/index.html");
        private final AntPathMatcher pathMatcher = new AntPathMatcher();
        private final PathResourceResolver defaultResolver = new PathResourceResolver();

        // Simple in-memory cache for performance
        private final Map<String, Resource> resourceCache = new ConcurrentHashMap<>();
        private static final long CACHE_TTL_MS = 300000; // 5 minutes

        // Track cache timestamps
        private final Map<String, Long> cacheTimestamps = new ConcurrentHashMap<>();

        @Override
        public Resource resolveResource(HttpServletRequest request, String requestPath,
                                        List<? extends Resource> locations, ResourceResolverChain chain) {
            long startTime = System.currentTimeMillis();

            try {
                // Clean old cache entries periodically
                cleanOldCacheEntries();

                // Check cache first
                Resource cached = getFromCache(requestPath);
                if (cached != null) {
                    log.trace("Cache hit for: {}", requestPath);
                    return cached;
                }

                // Skip API and special paths
                if (shouldSkipPath(requestPath)) {
                    apiRequestsIgnored.incrementAndGet();
                    log.debug("Skipping API path: {}", requestPath);
                    return null; // Let other handlers process this
                }

                // Check if it's a static file request
                if (isStaticFileRequest(requestPath)) {
                    Resource staticResource = resolveStaticResource(requestPath, locations);
                    if (staticResource != null && staticResource.exists() && staticResource.isReadable()) {
                        staticServed.incrementAndGet();
                        putInCache(requestPath, staticResource);
                        logStaticRequest(request, requestPath, staticResource, startTime);
                        return staticResource;
                    } else {
                        // Static file not found - log warning but don't serve index.html
                        log.warn("Static file not found or not readable: {}", requestPath);
                        // Return null to let other handlers try
                        return null;
                    }
                }

                // For SPA routes (non-static paths), serve index.html
                indexServed.incrementAndGet();
                putInCache(requestPath, indexResource);
                logSpaRequest(request, requestPath, startTime);
                return indexResource;

            } catch (Exception e) {
                log.error("Error resolving resource for path: {}. Error: {}",
                        requestPath, e.getMessage(), e);
                // Fallback: return null to let other handlers try
                return null;
            }
        }

        @Override
        public String resolveUrlPath(String resourcePath, List<? extends Resource> locations,
                                     ResourceResolverChain chain) {
            // Skip API paths
            if (shouldSkipPath(resourcePath)) {
                return null;
            }

            try {
                Resource resolvedResource = resolveResource(null, resourcePath, locations, chain);
                if (resolvedResource != null) {
                    return resolvedResource.getURL().toString();
                }
            } catch (IOException e) {
                log.trace("Error resolving URL path: {}", resourcePath);
            }
            return null;
        }

        /**
         * Check if path should be skipped (API endpoints, etc.)
         */
        private boolean shouldSkipPath(String path) {
            if (path == null || path.isEmpty() || "/".equals(path)) {
                return false;
            }

            // Check against API patterns
            for (String pattern : API_PATH_PATTERNS) {
                if (pathMatcher.match(pattern, path)) {
                    return true;
                }
            }

            // Additional security checks
            if (path.contains("/../") || path.contains("..")) {
                log.warn("Path traversal attempt detected: {}", path);
                return true;
            }

            // Special case: don't skip favicon.ico (handled separately)
            if ("/favicon.ico".equals(path)) {
                return false;
            }

            return false;
        }

        /**
         * Check if request is for a static file
         */
        private boolean isStaticFileRequest(String path) {
            if (path == null || path.isEmpty() || "/".equals(path)) {
                return false;
            }

            // Check if path ends with a file extension
            String extension = StringUtils.getFilenameExtension(path);
            if (extension == null) {
                // No extension - could be a SPA route
                return false;
            }

            String lowerExtension = extension.toLowerCase();

            // Check if it's a known static file extension
            boolean isStaticExtension = STATIC_EXTENSIONS.contains(lowerExtension);

            if (!isStaticExtension) {
                return false;
            }

            // Additional check: make sure it looks like a file, not a route parameter
            // Matches patterns like: /path/to/file.ext
            // But not: /path/to/.ext or /path/to/file.
            boolean looksLikeFile = path.matches("^[^.].*\\.[a-zA-Z0-9]{2,6}(\\?.*)?$");

            return looksLikeFile;
        }

        /**
         * Resolve static resource from locations (JAR compatible)
         */
        private Resource resolveStaticResource(String requestPath, List<? extends Resource> locations) {
            // Normalize path - remove leading slash if present
            String normalizedPath = requestPath.startsWith("/") ?
                    requestPath.substring(1) : requestPath;

            for (Resource location : locations) {
                try {
                    Resource resource = location.createRelative(normalizedPath);
                    if (resource.exists() && resource.isReadable()) {
                        // JAR-compatible check - just verify it exists and is readable
                        // Don't try to get canonical path for JAR resources
                        return resource;
                    }
                } catch (IOException e) {
                    // Log at trace level only
                    log.trace("Resource not found at {}: {}", location, normalizedPath);
                }
            }

            return null;
        }

        /**
         * Get resource from cache with TTL check
         */
        private Resource getFromCache(String key) {
            Long timestamp = cacheTimestamps.get(key);
            if (timestamp == null) {
                return null;
            }

            if (System.currentTimeMillis() - timestamp > CACHE_TTL_MS) {
                // Cache entry expired
                resourceCache.remove(key);
                cacheTimestamps.remove(key);
                return null;
            }

            return resourceCache.get(key);
        }

        /**
         * Put resource in cache
         */
        private void putInCache(String key, Resource resource) {
            if (resource == null) {
                return;
            }

            resourceCache.put(key, resource);
            cacheTimestamps.put(key, System.currentTimeMillis());

            // Clean old cache entries if cache grows too large
            if (resourceCache.size() > 1000) {
                cleanOldCacheEntries();
            }
        }

        /**
         * Clean old cache entries
         */
        private void cleanOldCacheEntries() {
            long now = System.currentTimeMillis();
            int cleaned = 0;

            Iterator<Map.Entry<String, Long>> iterator = cacheTimestamps.entrySet().iterator();
            while (iterator.hasNext()) {
                Map.Entry<String, Long> entry = iterator.next();
                if (now - entry.getValue() > CACHE_TTL_MS) {
                    resourceCache.remove(entry.getKey());
                    iterator.remove();
                    cleaned++;
                }
            }

            if (cleaned > 0 && log.isDebugEnabled()) {
                log.debug("Cleaned {} expired cache entries", cleaned);
            }
        }

        /**
         * Log static file request
         */
        private void logStaticRequest(HttpServletRequest request, String path,
                                      Resource resource, long startTime) {
            if (log.isDebugEnabled()) {
                long duration = System.currentTimeMillis() - startTime;
                String size = "unknown";
                try {
                    long contentLength = resource.contentLength();
                    size = contentLength > 0 ? formatFileSize(contentLength) : "unknown";
                } catch (IOException e) {
                    // Ignore - we'll use "unknown"
                }

                log.debug("✅ Serving static file: {} ({}), Duration: {}ms",
                        path, size, duration);
            } else if (log.isInfoEnabled() && !resourceCache.containsKey(path)) {
                // Log first-time access at info level
                log.info("Serving static file: {}", path);
            }
        }

        /**
         * Log SPA request (serving index.html)
         */
        private void logSpaRequest(HttpServletRequest request, String path, long startTime) {
            long duration = System.currentTimeMillis() - startTime;

            if (log.isDebugEnabled()) {
                String userAgent = request != null ?
                        abbreviateUserAgent(request.getHeader("User-Agent")) : "N/A";
                log.debug("🔄 Serving SPA index.html for: {}, Duration: {}ms, Agent: {}",
                        path, duration, userAgent);
            } else if (log.isInfoEnabled()) {
                // Only log at info level for first access or significant routes
                if (!resourceCache.containsKey(path) || path.equals("/") ||
                        path.startsWith("/db-world/")) {
                    log.info("Serving SPA route: {}", path);
                }
            }
        }

        /**
         * Format file size for human readable output
         */
        private String formatFileSize(long bytes) {
            if (bytes < 1024) return bytes + " B";
            if (bytes < 1024 * 1024) return String.format("%.1f KB", bytes / 1024.0);
            if (bytes < 1024 * 1024 * 1024) return String.format("%.1f MB", bytes / (1024.0 * 1024.0));
            return String.format("%.1f GB", bytes / (1024.0 * 1024.0 * 1024.0));
        }

        /**
         * Abbreviate user agent for logging
         */
        private String abbreviateUserAgent(String userAgent) {
            if (userAgent == null || userAgent.length() <= 60) {
                return userAgent;
            }
            return userAgent.substring(0, 57) + "...";
        }
    }

    /**
     * Content Versioning Transformer (simplified)
     */
    private static class ContentVersioningTransformer implements ResourceTransformer {
        private static final Pattern VERSIONED_FILE_PATTERN =
                Pattern.compile("^.+\\.([a-f0-9]{8,})\\.(js|css)$");

        @Override
        public Resource transform(HttpServletRequest request, Resource resource,
                                  ResourceTransformerChain chain) throws IOException {
            Resource transformed = chain.transform(request, resource);

            // Just pass through - versioning is handled by cache headers
            return transformed;
        }
    }

    /**
     * Get metrics for monitoring
     */
    public Map<String, Object> getMetrics() {
        if (!monitoringEnabled) {
            return Collections.emptyMap();
        }

        Map<String, Object> metrics = new LinkedHashMap<>();
        metrics.put("static_files_served", staticServed.get());
        metrics.put("spa_routes_served", indexServed.get());
        metrics.put("api_requests_ignored", apiRequestsIgnored.get());
        metrics.put("total_requests_handled",
                staticServed.get() + indexServed.get() + apiRequestsIgnored.get());

        return metrics;
    }

    /**
     * Health check for static resources
     */
    public boolean healthCheck() {
        try {
            // Check if index.html exists and is readable
            Resource index = new ClassPathResource("/public/index.html");
            boolean indexOk = index.exists() && index.isReadable();

            // Check if a sample static file exists
            Resource sample = new ClassPathResource("/public/DB_World_teal_circle.png");
            boolean sampleOk = sample.exists();

            log.info("Static resources health check - Index: {}, Sample: {}",
                    indexOk ? "OK" : "MISSING",
                    sampleOk ? "OK" : "MISSING");

            return indexOk; // Most important is index.html

        } catch (Exception e) {
            log.error("Static resources health check failed: {}", e.getMessage());
            return false;
        }
    }

    /**
     * Diagnostic method to check if a resource exists
     */
    public boolean resourceExists(String path) {
        try {
            Resource resource = new ClassPathResource("/public/" +
                    (path.startsWith("/") ? path.substring(1) : path));
            boolean exists = resource.exists();
            boolean readable = exists && resource.isReadable();

            log.info("Resource check - Path: {}, Exists: {}, Readable: {}",
                    path, exists, readable);

            return exists && readable;
        } catch (Exception e) {
            log.error("Resource check failed for {}: {}", path, e.getMessage());
            return false;
        }
    }
}