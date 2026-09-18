package com.db.dbworld.app.live.service;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/**
 * Enriches imported channels with the metadata an M3U cannot carry, from iptv-org's
 * published API.
 *
 * <p>A playlist line has a name, a logo and a group. Country, language and the owning
 * network are not in the format at all, so "show me Indian channels" or "show me
 * everything in Hindi" is unanswerable from the playlist alone. iptv-org publishes that
 * separately, keyed on the same {@code tvg-id} the playlist already uses.
 *
 * <p><b>Best-effort by design.</b> Every failure path — unreachable, malformed, unknown
 * channel — leaves the channel with whatever the parser derived and logs a warning. An
 * import must never fail because an optional enrichment source was down.
 *
 * <p>Note on {@code network}: it is stored for display but is NOT what the brand filter
 * uses. It covers only ~13% of channels and splits the brands people search for — Zee
 * appears as both "Z" and "Zee Media", Star as "Star Sports", "Star TV" and "JioStar".
 * {@code M3uParser.brandOf} groups those properly from the channel name instead.
 */
@Log4j2
@Component
public class IptvOrgEnricher {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final Duration FETCH_TIMEOUT = Duration.ofSeconds(90);

    /** What we keep per channel. Everything is optional. */
    public record Enrichment(
            String country,
            String countryName,
            String network,
            List<String> categories,
            List<String> languages
    ) {}

    /* ─── Wire shapes. Only the fields we use; the rest of each record is ignored. ─── */

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record ApiChannel(String id, String country, String network, List<String> categories) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record ApiFeed(String channel, Boolean is_main, List<String> languages) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record ApiNamed(String code, String name) {}

    @Value("${live.enrich.iptv-org.enabled:true}")
    private boolean enabled;

    @Value("${live.enrich.iptv-org.base-url:https://iptv-org.github.io/api}")
    private String baseUrl;

    /**
     * How long a download is reused. The upstream data changes on the order of days and
     * the four files are ~16 MB, so re-fetching them on every playlist in a refresh run
     * would dominate the import.
     */
    @Value("${live.enrich.iptv-org.ttl-hours:24}")
    private long ttlHours;

    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(15))
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();

    private Map<String, Enrichment> byChannelId = Map.of();
    private Instant loadedAt;

    /**
     * Metadata for a {@code tvg-id}, if iptv-org knows it.
     *
     * @return empty when enrichment is disabled, the data could not be loaded, or the id
     *         is not one iptv-org publishes
     */
    public Optional<Enrichment> forTvgId(String tvgId) {
        if (!enabled || tvgId == null || tvgId.isBlank()) return Optional.empty();
        return Optional.ofNullable(byChannelId.get(tvgId.strip()));
    }

    /** True once a successful load has happened and is still within its TTL. */
    public boolean isLoaded() {
        return loadedAt != null && !byChannelId.isEmpty() && !isStale();
    }

    private boolean isStale() {
        return loadedAt == null || loadedAt.isBefore(Instant.now().minus(Duration.ofHours(Math.max(1, ttlHours))));
    }

    /**
     * Load the API data if it is missing or past its TTL. Safe to call before every
     * import; it is a no-op on the runs that do not need it.
     *
     * @return how many channels are known after this call
     */
    public synchronized int refreshIfStale() {
        if (!enabled) return 0;
        if (!isStale()) return byChannelId.size();

        try {
            var countryNames  = names("countries.json");
            var languageNames = names("languages.json");
            var channels      = fetch("channels.json", new TypeReference<List<ApiChannel>>() {});
            var feeds         = fetch("feeds.json", new TypeReference<List<ApiFeed>>() {});

            // Languages live on the FEED, not the channel. A channel can have several
            // feeds (SD/HD, regional variants); the main one is the representative.
            Map<String, List<String>> langsByChannel = new HashMap<>();
            for (var feed : feeds) {
                if (feed.channel() == null || feed.languages() == null || feed.languages().isEmpty()) continue;
                var main = Boolean.TRUE.equals(feed.is_main());
                // A main feed replaces whatever a secondary one contributed; otherwise
                // first-seen wins, so a channel with no main feed still gets languages.
                if (main || !langsByChannel.containsKey(feed.channel())) {
                    langsByChannel.put(feed.channel(), feed.languages());
                }
            }

            Map<String, Enrichment> built = HashMap.newHashMap(channels.size());
            for (var channel : channels) {
                if (channel.id() == null) continue;
                var code = channel.country() == null ? null : channel.country().toUpperCase(Locale.ROOT);
                built.put(channel.id(), new Enrichment(
                        code,
                        code == null ? null : countryNames.getOrDefault(code, code),
                        blankToNull(channel.network()),
                        titleCased(channel.categories()),
                        resolveNames(langsByChannel.get(channel.id()), languageNames)));
            }

            byChannelId = Map.copyOf(built);
            loadedAt    = Instant.now();
            log.info("iptv-org enrichment loaded — {} channels, {} with languages", built.size(), langsByChannel.size());
        } catch (Exception e) {
            // Keep any previous snapshot rather than dropping to nothing on a blip.
            log.warn("iptv-org enrichment unavailable ({}); importing with playlist-derived data only", e.toString());
            if (loadedAt == null) byChannelId = Map.of();
        }
        return byChannelId.size();
    }

    private <T> List<T> fetch(String file, TypeReference<List<T>> type) throws Exception {
        var request = HttpRequest.newBuilder(URI.create(baseUrl + "/" + file))
                .timeout(FETCH_TIMEOUT)
                .header("Accept", "application/json")
                .GET()
                .build();
        HttpResponse<InputStream> response = http.send(request, HttpResponse.BodyHandlers.ofInputStream());
        try (var body = response.body()) {
            if (response.statusCode() / 100 != 2) {
                throw new IllegalStateException(file + " returned HTTP " + response.statusCode());
            }
            List<T> parsed = MAPPER.readValue(body, type);
            return parsed == null ? List.of() : parsed;
        }
    }

    /** {@code code -> name} from one of the small lookup files. */
    private Map<String, String> names(String file) throws Exception {
        Map<String, String> out = new HashMap<>();
        for (var row : fetch(file, new TypeReference<List<ApiNamed>>() {})) {
            if (row.code() != null && row.name() != null) out.put(row.code(), row.name());
        }
        return out;
    }

    private static List<String> resolveNames(List<String> codes, Map<String, String> lookup) {
        if (codes == null || codes.isEmpty()) return List.of();
        var out = new LinkedHashSet<String>();
        for (var code : codes) {
            if (code == null || code.isBlank()) continue;
            out.add(lookup.getOrDefault(code, code));
        }
        return List.copyOf(out);
    }

    /** The API writes categories lower-case ("news"); the playlist writes them capitalised. */
    private static List<String> titleCased(List<String> values) {
        if (values == null || values.isEmpty()) return List.of();
        var out = new ArrayList<String>(values.size());
        for (var value : values) {
            if (value == null || value.isBlank()) continue;
            var v = value.strip();
            out.add(v.substring(0, 1).toUpperCase(Locale.ROOT) + v.substring(1));
        }
        return List.copyOf(out);
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.strip();
    }
}
