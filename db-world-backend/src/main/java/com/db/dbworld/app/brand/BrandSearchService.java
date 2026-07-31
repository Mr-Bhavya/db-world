package com.db.dbworld.app.brand;

import tools.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Server-side proxy for logo.dev's Brand Search API. Keeps the secret key on the
 * server and caches results (brand↔domain mappings barely change) so a burst of
 * keystrokes from the URL field doesn't burn quota.
 *
 * Designed to fail SOFT: any problem (key not configured, upstream error) yields
 * an empty list rather than an exception, so the add-credential flow keeps
 * working with no online suggestions instead of breaking.
 */
@Log4j2
@Service
@RequiredArgsConstructor
public class BrandSearchService {

    private static final int      MAX_RESULTS = 8;
    private static final int      MIN_QUERY   = 2;
    private static final Duration CACHE_TTL   = Duration.ofHours(6);

    private final LogoDevProperties props;
    private final RestClient restClient = RestClient.create();

    private final ConcurrentHashMap<String, CacheEntry> cache = new ConcurrentHashMap<>();
    private record CacheEntry(Instant at, List<BrandSuggestion> payload) {}

    public List<BrandSuggestion> search(String query) {
        String q = query == null ? "" : query.trim();
        if (q.length() < MIN_QUERY) return List.of();

        if (props.getSecretKey() == null || props.getSecretKey().isBlank()) {
            log.debug("logo.dev secret key not configured — brand search disabled");
            return List.of();
        }

        String key = q.toLowerCase();
        CacheEntry hit = cache.get(key);
        if (hit != null && Duration.between(hit.at(), Instant.now()).compareTo(CACHE_TTL) < 0) {
            return hit.payload();
        }

        String url = props.getBaseUrl() + "/search?q=" + URLEncoder.encode(q, StandardCharsets.UTF_8);
        try {
            JsonNode body = restClient.get()
                    .uri(url)
                    .header("Authorization", "Bearer " + props.getSecretKey())
                    .retrieve()
                    .body(JsonNode.class);

            List<BrandSuggestion> out = new ArrayList<>();
            if (body != null && body.isArray()) {
                for (JsonNode n : body) {
                    String domain = n.path("domain").asText("");
                    if (domain.isBlank()) continue;
                    out.add(new BrandSuggestion(
                            n.path("name").asText(domain),
                            domain,
                            n.path("logo_url").asText(null)));
                    if (out.size() >= MAX_RESULTS) break;
                }
            }
            cache.put(key, new CacheEntry(Instant.now(), out));
            return out;
        } catch (RestClientException e) {
            log.warn("logo.dev brand search failed for q='{}': {}", q, e.getMessage());
            return List.of();
        }
    }
}
