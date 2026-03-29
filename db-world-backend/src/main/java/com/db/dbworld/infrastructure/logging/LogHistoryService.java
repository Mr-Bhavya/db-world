package com.db.dbworld.infrastructure.logging;

import com.db.dbworld.utils.DbWorldRuntimeProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.apache.commons.io.input.ReversedLinesFileReader;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.zip.GZIPInputStream;
import java.util.stream.Stream;

@Service
@RequiredArgsConstructor
@Log4j2
public class LogHistoryService {

    private final ObjectMapper mapper;
    private final DbWorldRuntimeProperties props;

    // ---------- CONFIG ----------

    private static final int MAX_LOGS_PER_STREAM = 50_000;
    private static final int TAIL_LINES = 25_000;

    // ---------- LRU PATH CACHE ----------

    private final Map<String, Path> pathCache =
            Collections.synchronizedMap(
                    new LinkedHashMap<>(16, 0.75f, true) {
                        protected boolean removeEldestEntry(Map.Entry eldest) {
                            return size() > 12;
                        }
                    });

    // ---------- EXECUTORS ----------

    private final ExecutorService ioPool =
            Executors.newFixedThreadPool(
                    Math.min(8, Runtime.getRuntime().availableProcessors() * 2),
                    new NamedFactory("log-io"));

    private final ScheduledExecutorService scheduler =
            Executors.newScheduledThreadPool(2, new NamedFactory("log-sched"));

    // ---------- STREAM TRACKING ----------

    private final Map<String, Future<?>> activeStreams = new ConcurrentHashMap<>();
    private final Map<String, Instant> streamStart = new ConcurrentHashMap<>();

    // ---------- INIT ----------

    @PostConstruct
    void init() {
        scheduler.scheduleAtFixedRate(this::cleanupStale, 1, 1, TimeUnit.MINUTES);
    }

    // ============================================================
    // FILE RESOLUTION
    // ============================================================

    public Path resolveLogFile(String level) {
        return pathCache.computeIfAbsent(level.toUpperCase(), k -> {
            Path dir = props.getMainLogPath().getParent();
            return dir.resolve(switch (k) {
                case "ERROR" -> "db-world-error.json";
                case "DEBUG" -> "db-world-debug.json";
                case "REQUEST" -> "db-world-request.json";
                default -> "db-world-info.json";
            });
        });
    }

    // ============================================================
    // INDEXED HISTORY STREAM
    // ============================================================

    public void streamHistory(
            WebSocketSession session,
            Instant since,
            String level,
            int limit
    ) {
        cancelStream(session.getId());

        scheduler.scheduleAtFixedRate(
                () -> safeSend(session,
                        "{\"action\":\"keepalive\",\"t\":\"" + Instant.now() + "\"}"),
                15, 15, TimeUnit.SECONDS
        );

        Future<?> f = ioPool.submit(() -> {
            long sent = 0;
            try {
                streamStart.put(session.getId(), Instant.now());

                Path file = resolveLogFile(level);
                if (!Files.exists(file)) {
                    sendComplete(session, sent);
                    return;
                }

                // ---- active file tail first ----

                for (String line : reverseTail(file, TAIL_LINES)) {
                    if (!session.isOpen() || sent >= limit) break;
                    if (fastAfter(line, since)) {
                        safeSend(session, line);
                        sent++;
                    }
                }

                // ---- rotated gzip ----

                try (Stream<Path> gz = Files.list(file.getParent())) {
                    for (Path p : gz
                            .filter(x -> x.toString().endsWith(".gz"))
                            .sorted(Comparator.reverseOrder())
                            .limit(5)
                            .toList()) {

                        if (!session.isOpen() || sent >= limit) break;

                        streamGzip(p, since, session, limit - sent);
                        sent = sentCount.get();
                    }
                }

                sendComplete(session, sent);

            } catch (Exception e) {
                log.warn("history stream failed", e);
            } finally {
                activeStreams.remove(session.getId());
                streamStart.remove(session.getId());
            }
        });

        activeStreams.put(session.getId(), f);
    }

    // ============================================================
    // ANALYTICS AGGREGATION
    // ============================================================

    public Map<Long, Bucket> aggregate(Instant since, String level, long bucketMs) throws Exception {

        Map<Long, Bucket> buckets = new TreeMap<>();

        Path file = resolveLogFile(level);

        for (String line : reverseTail(file, TAIL_LINES)) {
            long ts = fastTs(line);
            if (ts == 0 || ts < since.toEpochMilli()) continue;

            long key = (ts / bucketMs) * bucketMs;

            Bucket b = buckets.computeIfAbsent(key, k -> new Bucket());
            b.total++;
            if (line.contains("\"level\":\"ERROR\"")) b.errors++;
        }

        return buckets;
    }

    public static class Bucket {
        public int total;
        public int errors;
    }

    // ============================================================
    // FAST TIMESTAMP INDEX PARSER (NO JACKSON)
    // ============================================================

    private long fastTs(String json) {
        int i = json.indexOf("\"timestamp\"");
        if (i < 0) return 0;
        int s = json.indexOf('"', i + 11);
        int e = json.indexOf('"', s + 1);
        if (s < 0 || e < 0) return 0;
        try {
            return Instant.parse(json.substring(s + 1, e)).toEpochMilli();
        } catch (Exception ex) {
            return 0;
        }
    }

    private boolean fastAfter(String json, Instant since) {
        long ts = fastTs(json);
        return ts > 0 && ts >= since.toEpochMilli();
    }

    // ============================================================
    // REVERSE TAIL (CORRECT + FAST)
    // ============================================================

    public List<String> reverseTail(Path file, int max) throws IOException {
        List<String> out = new ArrayList<>(max);
        try (ReversedLinesFileReader r =
                     new ReversedLinesFileReader(file.toFile(), 8192, StandardCharsets.UTF_8)) {
            String line;
            while ((line = r.readLine()) != null && out.size() < max) {
                if (!line.isBlank()) out.add(line);
            }
        }
        Collections.reverse(out);
        return out;
    }

    // ============================================================
    // GZIP STREAM — CONSTANT MEMORY
    // ============================================================

    private final AtomicInteger sentCount = new AtomicInteger();

    private void streamGzip(Path gz, Instant since,
                            WebSocketSession session,
                            Long remaining) {

        try (BufferedReader br = new BufferedReader(
                new InputStreamReader(
                        new GZIPInputStream(Files.newInputStream(gz)),
                        StandardCharsets.UTF_8))) {

            String line;
            while ((line = br.readLine()) != null &&
                    session.isOpen() &&
                    sentCount.get() < remaining) {

                if (fastAfter(line, since)) {
                    safeSend(session, line);
                    sentCount.incrementAndGet();
                }
            }

        } catch (Exception e) {
            log.debug("gzip read fail {}", gz);
        }
    }

    // ============================================================
    // SESSION SAFE SEND
    // ============================================================

    private void safeSend(WebSocketSession s, String m) {
        if (s == null || !s.isOpen()) return;
        try {
            synchronized (s) {
                if (s.isOpen())
                    s.sendMessage(new TextMessage(m));
            }
        } catch (Exception e) {
            safeClose(s);
        }
    }

    private void safeClose(WebSocketSession s) {
        try { if (s.isOpen()) s.close(); } catch (Exception ignore) {}
    }

    private void sendComplete(WebSocketSession s, long n) {
        safeSend(s, "{\"action\":\"stream_complete\",\"sent\":" + n + "}");
    }

    // ============================================================
    // STREAM CONTROL
    // ============================================================

    public void cancelStream(String id) {
        Future<?> f = activeStreams.remove(id);
        if (f != null) f.cancel(true);
        streamStart.remove(id);
    }

    private void cleanupStale() {
        Instant cutoff = Instant.now().minusSeconds(600);
        streamStart.entrySet().removeIf(e -> {
            if (e.getValue().isBefore(cutoff)) {
                cancelStream(e.getKey());
                return true;
            }
            return false;
        });
    }

    // ============================================================
    // SHUTDOWN
    // ============================================================

    @PreDestroy
    void shutdown() {
        activeStreams.values().forEach(f -> f.cancel(true));
        ioPool.shutdownNow();
        scheduler.shutdownNow();
    }

    // ============================================================
    // THREAD FACTORY
    // ============================================================

    static class NamedFactory implements ThreadFactory {
        private final String name;
        private final AtomicInteger c = new AtomicInteger();
        NamedFactory(String n){name=n;}
        public Thread newThread(Runnable r){
            Thread t=new Thread(r,name+"-"+c.incrementAndGet());
            t.setDaemon(true);
            return t;
        }
    }
}
