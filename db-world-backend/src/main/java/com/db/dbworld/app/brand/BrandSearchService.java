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
import java.util.Locale;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Server-side proxy for logo.dev's Brand Search API. Keeps the secret key on the
 * server and caches results (brand↔domain mappings barely change) so a burst of
 * keystrokes from the URL field doesn't burn quota.
 *
 * A bundled catalogue covers common sites when the secret is absent or the upstream
 * service fails. The add-credential flow therefore remains useful offline; an
 * online response only broadens the result set.
 */
@Log4j2
@Service
@RequiredArgsConstructor
public class BrandSearchService {

    private static final int      MAX_RESULTS = 8;
    private static final int      MIN_QUERY   = 2;
    private static final Duration CACHE_TTL   = Duration.ofHours(6);
    private static final List<BrandSuggestion> LOCAL_BRANDS = List.of(
            new BrandSuggestion("Netflix", "netflix.com", null),
            new BrandSuggestion("YouTube", "youtube.com", null),
            new BrandSuggestion("Google", "google.com", null),
            new BrandSuggestion("Gmail", "gmail.com", null),
            new BrandSuggestion("GitHub", "github.com", null),
            new BrandSuggestion("GitLab", "gitlab.com", null),
            new BrandSuggestion("Microsoft", "microsoft.com", null),
            new BrandSuggestion("Outlook", "outlook.com", null),
            new BrandSuggestion("Office 365", "office.com", null),
            new BrandSuggestion("Amazon", "amazon.in", null),
            new BrandSuggestion("Amazon", "amazon.com", null),
            new BrandSuggestion("Flipkart", "flipkart.com", null),
            new BrandSuggestion("Myntra", "myntra.com", null),
            new BrandSuggestion("Instagram", "instagram.com", null),
            new BrandSuggestion("Facebook", "facebook.com", null),
            new BrandSuggestion("WhatsApp", "whatsapp.com", null),
            new BrandSuggestion("Telegram", "telegram.org", null),
            new BrandSuggestion("LinkedIn", "linkedin.com", null),
            new BrandSuggestion("X", "x.com", null),
            new BrandSuggestion("Twitter", "twitter.com", null),
            new BrandSuggestion("Reddit", "reddit.com", null),
            new BrandSuggestion("Spotify", "spotify.com", null),
            new BrandSuggestion("Disney+ Hotstar", "hotstar.com", null),
            new BrandSuggestion("Prime Video", "primevideo.com", null),
            new BrandSuggestion("Apple", "apple.com", null),
            new BrandSuggestion("iCloud", "icloud.com", null),
            new BrandSuggestion("Dropbox", "dropbox.com", null),
            new BrandSuggestion("Notion", "notion.so", null),
            new BrandSuggestion("Slack", "slack.com", null),
            new BrandSuggestion("Figma", "figma.com", null),
            new BrandSuggestion("Canva", "canva.com", null),
            new BrandSuggestion("Adobe", "adobe.com", null),
            new BrandSuggestion("Zoom", "zoom.us", null),
            new BrandSuggestion("PayPal", "paypal.com", null),
            new BrandSuggestion("Stripe", "stripe.com", null),
            new BrandSuggestion("HDFC Bank", "hdfcbank.com", null),
            new BrandSuggestion("ICICI Bank", "icicibank.com", null),
            new BrandSuggestion("SBI", "onlinesbi.sbi", null),
            new BrandSuggestion("Axis Bank", "axisbank.com", null),
            new BrandSuggestion("Kotak Mahindra Bank", "kotak.com", null),
            new BrandSuggestion("PhonePe", "phonepe.com", null),
            new BrandSuggestion("Google Pay", "pay.google.com", null),
            new BrandSuggestion("Paytm", "paytm.com", null),
            new BrandSuggestion("Zerodha", "zerodha.com", null),
            new BrandSuggestion("Groww", "groww.in", null),
            new BrandSuggestion("Cred", "cred.club", null),
            new BrandSuggestion("Swiggy", "swiggy.com", null),
            new BrandSuggestion("Zomato", "zomato.com", null),
            new BrandSuggestion("Uber", "uber.com", null),
            new BrandSuggestion("Ola", "olacabs.com", null),
            new BrandSuggestion("Booking.com", "booking.com", null),
            new BrandSuggestion("Airbnb", "airbnb.com", null),
            new BrandSuggestion("IRCTC", "irctc.co.in", null)
    );

    private final LogoDevProperties props;
    private final RestClient restClient = RestClient.create();

    private final ConcurrentHashMap<String, CacheEntry> cache = new ConcurrentHashMap<>();
    private record CacheEntry(Instant at, List<BrandSuggestion> payload) {}

    public List<BrandSuggestion> search(String query) {
        String q = query == null ? "" : query.trim();
        if (q.length() < MIN_QUERY) return List.of();

        String key = q.toLowerCase();
        CacheEntry hit = cache.get(key);
        if (hit != null && Duration.between(hit.at(), Instant.now()).compareTo(CACHE_TTL) < 0) {
            return hit.payload();
        }

        List<BrandSuggestion> local = searchLocal(q);
        if (props.getSecretKey() == null || props.getSecretKey().isBlank()) {
            log.debug("logo.dev secret key not configured — serving {} local suggestions for '{}'",
                    local.size(), q);
            cache.put(key, new CacheEntry(Instant.now(), local));
            return local;
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
            List<BrandSuggestion> merged = merge(local, out);
            cache.put(key, new CacheEntry(Instant.now(), merged));
            return merged;
        } catch (RestClientException e) {
            log.warn("logo.dev brand search failed for q='{}': {}", q, e.getMessage());
            cache.put(key, new CacheEntry(Instant.now(), local));
            return local;
        }
    }

    private static List<BrandSuggestion> searchLocal(String query) {
        String q = squash(query);
        return LOCAL_BRANDS.stream()
                .filter(brand -> squash(brand.name()).contains(q)
                        || squash(brand.domain()).contains(q))
                .limit(MAX_RESULTS)
                .toList();
    }

    private static List<BrandSuggestion> merge(
            List<BrandSuggestion> preferred, List<BrandSuggestion> remote) {
        java.util.LinkedHashMap<String, BrandSuggestion> merged = new java.util.LinkedHashMap<>();
        preferred.forEach(item -> merged.put(item.domain().toLowerCase(Locale.ROOT), item));
        remote.forEach(item -> merged.putIfAbsent(item.domain().toLowerCase(Locale.ROOT), item));
        return merged.values().stream().limit(MAX_RESULTS).toList();
    }

    private static String squash(String value) {
        return value == null ? "" : value.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
    }
}
