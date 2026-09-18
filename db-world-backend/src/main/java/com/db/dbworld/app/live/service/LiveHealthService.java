package com.db.dbworld.app.live.service;

import com.db.dbworld.app.live.entity.LiveChannelSourceEntity;
import com.db.dbworld.app.live.entity.LiveHealth;
import com.db.dbworld.app.live.repository.LiveChannelRepository;
import com.db.dbworld.app.live.repository.LiveChannelSourceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.stream.Collectors;

/**
 * Probes stream URLs and records whether they are alive.
 *
 * <p>This exists because public playlists rot: a large one has a substantial dead
 * fraction at any moment — channels that moved, were geo-blocked, or were switched off.
 * Without this job the channel grid is a list of links that fail one tap at a time.
 *
 * <p>A probe reads the first few KB of the URL. For HLS that is the manifest, which must
 * begin with {@code #EXTM3U}; anything else returning 2xx with bytes is accepted, because
 * a raw MPEG-TS feed has no manifest to inspect.
 */
@Log4j2
@Service
@RequiredArgsConstructor
public class LiveHealthService {

    /** Past this many consecutive failures a source drops out of the probe queue. */
    public static final int MAX_FAILURES = 8;

    private static final Duration PROBE_TIMEOUT = Duration.ofSeconds(8);
    private static final int      PROBE_BYTES   = 8192;
    private static final String   DEFAULT_UA =
            "Mozilla/5.0 (compatible; DbWorld/1.0; +https://db-world.in)";

    private final LiveChannelSourceRepository sources;
    private final LiveChannelRepository       channels;

    /**
     * How many probes run at once. Kept low by default: this runs on a Raspberry Pi with a
     * home uplink, and a burst of hundreds of concurrent connections degrades everything
     * else the box is serving.
     */
    @Value("${live.health.concurrency:6}")
    private int concurrency;

    /**
     * Sources probed per run. Without a cap the job walks the entire table — at six
     * concurrent connections and an 8s timeout that is many minutes for a large playlist,
     * which is how a run ended up still executing when the application shut down (it then
     * failed trying to use a closed context). The queue is ordered least-recently-checked
     * first, so successive runs roll through the whole table anyway.
     */
    @Value("${live.health.batch-size:400}")
    private int batchSize;

    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(6))
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();

    /** Outcome of one probe sweep. */
    public record HealthResult(int probed, int up, int down, int channelsUp, int channelsDown) {}

    /** Probe the next slice of eligible sources and roll the verdicts up onto their channels. */
    public HealthResult probeAll() {
        return probe(sources.findProbeQueue(MAX_FAILURES, PageRequest.of(0, Math.max(1, batchSize))));
    }

    /** Probe the sources of a single channel — the admin "test now" button. */
    public HealthResult probeChannel(String channelId) {
        return probe(sources.findByChannelIdOrderByPriorityAscCreatedAtAsc(channelId));
    }

    private HealthResult probe(List<LiveChannelSourceEntity> queue) {
        if (queue.isEmpty()) return new HealthResult(0, 0, 0, 0, 0);

        var results = runProbes(queue);
        // A shutdown interrupts the pool mid-sweep. Writing the partial verdicts would be
        // harmless, but the context may already be closing, so bail out instead.
        if (Thread.currentThread().isInterrupted()) {
            log.warn("Live health sweep interrupted after {} of {} probes — discarding this run",
                    results.size(), queue.size());
            return new HealthResult(0, 0, 0, 0, 0);
        }
        persist(queue, results);

        // Only the channels this sweep actually touched. Re-deriving health for the whole
        // table would load every channel on every run, which on a large import is the
        // most expensive thing the job does and changes nothing.
        var touched = queue.stream().map(LiveChannelSourceEntity::getChannelId).collect(Collectors.toSet());
        var rolled  = rollUpChannels(touched);

        var up = (int) results.values().stream().filter(Boolean::booleanValue).count();
        log.info("Live health sweep — {} sources probed, {} up, {} down", queue.size(), up, queue.size() - up);
        return new HealthResult(queue.size(), up, queue.size() - up, rolled.up(), rolled.down());
    }

    /** Run the probes on a bounded pool, keyed by source id. */
    private Map<String, Boolean> runProbes(List<LiveChannelSourceEntity> queue) {
        try (ExecutorService pool = Executors.newFixedThreadPool(Math.max(1, concurrency))) {
            List<Callable<Map.Entry<String, Boolean>>> tasks = queue.stream()
                    .<Callable<Map.Entry<String, Boolean>>>map(s -> () -> Map.entry(s.getId(), probeOne(s)))
                    .toList();

            return pool.invokeAll(tasks).stream()
                    .map(f -> {
                        try { return f.get(); }
                        catch (InterruptedException e) { Thread.currentThread().interrupt(); return null; }
                        catch (Exception e) { return null; }
                    })
                    .filter(Objects::nonNull)
                    .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return Map.of();
        }
    }

    private void persist(List<LiveChannelSourceEntity> queue, Map<String, Boolean> results) {
        var now = Instant.now();
        for (var source : queue) {
            var ok = results.get(source.getId());
            if (ok == null) continue;   // probe never completed — leave the last verdict alone
            source.setLastCheckedAt(now);
            if (ok) {
                source.setHealth(LiveHealth.UP);
                source.setFailCount(0);
                source.setLastError(null);
            } else {
                source.setHealth(LiveHealth.DOWN);
                source.setFailCount(source.getFailCount() + 1);
                source.setLastError("Unreachable on the last check");
            }
        }
        sources.saveAll(queue);
    }

    private record RollUp(int up, int down) {}

    /**
     * A channel is UP when any enabled source is UP, DOWN when every enabled source is
     * DOWN, and UNKNOWN until one has a verdict. Rolling up rather than storing health
     * only on the channel is what keeps a channel visible while one of its mirrors is dead.
     */
    private RollUp rollUpChannels(Set<String> channelIds) {
        if (channelIds.isEmpty()) return new RollUp(0, 0);

        var all       = channels.findAllById(channelIds);
        var byChannel = sources.findByChannelIdIn(channelIds).stream()
                .collect(Collectors.groupingBy(LiveChannelSourceEntity::getChannelId));
        var now  = Instant.now();
        var up   = 0;
        var down = 0;

        for (var channel : all) {
            var mine = byChannel.getOrDefault(channel.getId(), List.of()).stream()
                    .filter(LiveChannelSourceEntity::isEnabled)
                    .toList();

            var health = mine.isEmpty() ? LiveHealth.UNKNOWN
                    : mine.stream().anyMatch(s -> s.getHealth() == LiveHealth.UP)   ? LiveHealth.UP
                    : mine.stream().allMatch(s -> s.getHealth() == LiveHealth.DOWN) ? LiveHealth.DOWN
                    : LiveHealth.UNKNOWN;

            if (health == LiveHealth.UP)   up++;
            if (health == LiveHealth.DOWN) down++;
            channel.setHealth(health);
            if (mine.stream().anyMatch(s -> s.getLastCheckedAt() != null)) channel.setLastCheckedAt(now);
        }
        channels.saveAll(all);
        return new RollUp(up, down);
    }

    /**
     * One probe. False for any transport error, non-2xx, empty body, or a response that
     * claims to be a manifest but is not one.
     */
    private boolean probeOne(LiveChannelSourceEntity source) {
        try {
            var builder = HttpRequest.newBuilder(URI.create(source.getUrl()))
                    .timeout(PROBE_TIMEOUT)
                    .header("User-Agent", isBlank(source.getUserAgent()) ? DEFAULT_UA : source.getUserAgent())
                    // Ask for only the opening bytes. A server that ignores Range sends the
                    // whole thing, which is why the read below stops on its own.
                    .header("Range", "bytes=0-" + (PROBE_BYTES - 1))
                    .GET();
            if (!isBlank(source.getReferer())) builder.header("Referer", source.getReferer());

            HttpResponse<InputStream> response = http.send(builder.build(), HttpResponse.BodyHandlers.ofInputStream());
            try (var body = response.body()) {
                if (response.statusCode() / 100 != 2) return false;

                var contentType = response.headers().firstValue("content-type").orElse("");
                return isPlayableResponse(source.getUrl(), contentType, readHead(body));
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return false;
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Whether a 2xx response is actually something the player could open.
     *
     * <p>Split out from the request so it can be tested without a server, because the
     * naive version of this check shipped once: it accepted any 2xx with bytes unless the
     * URL said {@code .m3u8}. Several curated playlists list {@code
     * youtube.com/<channel>/live} as the stream, which answers 200 with a megabyte of
     * HTML — 22 of the 32 channels in one Indian playlist would have been marked healthy
     * and played nothing.
     *
     * @param url         the source URL, used only to decide whether a manifest is required
     * @param contentType the response's Content-Type, possibly blank or wrong
     * @param head        the first few KB of the body
     */
    static boolean isPlayableResponse(String url, String contentType, String head) {
        if (head == null || head.isBlank()) return false;

        // A stream is never a web page. Covers both a dead endpoint serving a 200 error
        // page and a "stream" URL that was always a page.
        var type = contentType == null ? "" : contentType.toLowerCase(Locale.ROOT);
        if (type.contains("text/html") || type.contains("xhtml")) return false;

        var start = head.stripLeading();

        // An HLS URL must answer with a manifest, whatever content type it claims — IPTV
        // servers variously send octet-stream, text/plain, or the correct one.
        if (url != null && url.toLowerCase(Locale.ROOT).contains(".m3u8")) {
            return start.startsWith("#EXTM3U");
        }

        // Otherwise: an HTML body under a lying content type is still a page.
        return !start.regionMatches(true, 0, "<!doctype", 0, 9)
                && !start.regionMatches(true, 0, "<html", 0, 5);
    }

    private String readHead(InputStream in) {
        try {
            var buffer = new byte[PROBE_BYTES];
            var total  = 0;
            int read;
            while (total < buffer.length && (read = in.read(buffer, total, buffer.length - total)) != -1) {
                total += read;
            }
            return new String(buffer, 0, total, StandardCharsets.UTF_8);
        } catch (Exception e) {
            return "";
        }
    }

    private static boolean isBlank(String s) { return s == null || s.isBlank(); }
}
