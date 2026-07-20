package com.db.dbworld.infrastructure.logging;

import com.db.dbworld.infrastructure.logging.dto.LogFormat;
import com.db.dbworld.infrastructure.logging.dto.LogSource;
import com.db.dbworld.infrastructure.logging.dto.LogType;
import com.db.dbworld.infrastructure.logging.parser.*;
import com.db.dbworld.config.AppProperties;
import lombok.extern.log4j.Log4j2;
import org.apache.commons.io.input.ReversedLinesFileReader;
import org.springframework.stereotype.Service;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Consumer;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import java.util.zip.GZIPInputStream;

@Log4j2
@Service
public class LogsService {

    private final AppProperties props;
    private final Map<LogType, LogLineParser<?>> appParsers;
    private final Map<String, FollowSession> followSessions = new ConcurrentHashMap<>();

    private static final DateTimeFormatter LOG_TS_FORMAT =
            DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSSZ");
    private static final int DEFAULT_MAX_LINES = 500;
    private static final int BUFFER_SIZE = 8192;

    public LogsService(AppProperties props) {
        this.props = props;
        this.appParsers = initParsers();
    }

    private Map<LogType, LogLineParser<?>> initParsers() {
        Map<LogType, LogLineParser<?>> m = new EnumMap<>(LogType.class);
        m.put(LogType.ERROR, new ErrorLogParser());
        m.put(LogType.DEBUG, new DebugLogParser());
        m.put(LogType.INFO, new InfoLogParser());
        m.put(LogType.REQUEST, new RequestLogParser());
        return Collections.unmodifiableMap(m);
    }

    // =====================================================================
    // BACKWARD-COMPATIBLE: used by old LogsController
    // =====================================================================

    public LogResponse getLogs(LogType type, LogFormat format, Integer lines, Integer minutes)
            throws IOException {
        log.debug("getLogs type={} format={} lines={} minutes={}", type, format, lines, minutes);
        Path file = resolveActivePath("app", type.name().toLowerCase(), format);
        if (!Files.exists(file)) return new LogResponse(Collections.emptyList(), 0);

        int max = (lines != null && lines > 0) ? lines : DEFAULT_MAX_LINES;
        List<String> rawLines;

        if (minutes != null && minutes > 0) {
            OffsetDateTime cutoff = OffsetDateTime.now().minusMinutes(minutes);
            rawLines = filterByTimestampCutoff(tailLines(file, max), cutoff);
        } else {
            rawLines = tailLines(file, max);
        }
        return buildResponse(type, format, rawLines);
    }

    public FollowSession followLogs(LogType type, LogFormat format, String sessionId,
                                    Consumer<String> consumer) throws IOException {
        return followLogsForSource("app", type.name().toLowerCase(), format, sessionId, consumer);
    }

    // =====================================================================
    // MULTI-SOURCE API: used by AdminLogsController
    // =====================================================================

    /**
     * Query logs for any source.
     * date == null â†’ read from the active live log file.
     * date != null â†’ read from rotated gzip archives for that date.
     */
    public LogResponse getLogsForSource(String source, String subType,
                                        LogFormat format, Integer lines, LocalDate date)
            throws IOException {
        log.debug("getLogsForSource source={} subType={} format={} lines={} date={}",
                source, subType, format, lines, date);

        int max = (lines != null && lines > 0) ? lines : DEFAULT_MAX_LINES;
        List<String> rawLines = new ArrayList<>();
        boolean fileFound = false;

        boolean isToday = date == null || date.equals(LocalDate.now());

        if (isToday) {
            Path active = resolveActivePath(source, subType, format);
            fileFound = Files.exists(active);
            if (fileFound) {
                rawLines.addAll(tailLines(active, max));
            }
        } else {
            List<Path> archives = resolveRotatedPaths(source, subType, format, date);
            fileFound = !archives.isEmpty();
            for (Path gz : archives) {
                if (rawLines.size() >= max) break;
                rawLines.addAll(readGzip(gz, max - rawLines.size()));
            }
        }

        if (format == LogFormat.RAW || !source.equalsIgnoreCase("app")) {
            return new LogResponse(rawLines, rawLines.size(), fileFound);
        }

        LogType appType = parseLogType(subType);
        LogResponse base = buildResponse(appType, format, rawLines);
        return new LogResponse(base.getData(), base.getCount(), fileFound);
    }

    /**
     * Returns available historical dates (from rotated archives), newest first.
     * Always includes today. Capped at 15 days.
     */
    public List<String> getAvailableDates(String source, String subType, LogFormat format)
            throws IOException {

        Set<LocalDate> dates = new TreeSet<>();
        dates.add(LocalDate.now());

        if (!source.equalsIgnoreCase("app")) {
            return dates.stream()
                    .sorted(Comparator.reverseOrder())
                    .map(LocalDate::toString)
                    .collect(Collectors.toList());
        }

        Path rotatedDir = props.getLogsPath().resolve("rotated").resolve("app");
        if (!Files.exists(rotatedDir)) {
            return List.of(LocalDate.now().toString());
        }

        String ext = (format == LogFormat.JSON) ? ".json.gz" : ".log.gz";
        String prefix = "db-world-" + subType.toLowerCase() + "-";
        LocalDate cutoff = LocalDate.now().minusDays(15);

        try (Stream<Path> stream = Files.list(rotatedDir)) {
            stream.map(p -> p.getFileName().toString())
                    .filter(name -> name.startsWith(prefix) && name.endsWith(ext))
                    .forEach(name -> {
                        try {
                            String datePart = name.substring(prefix.length(), prefix.length() + 10);
                            LocalDate d = LocalDate.parse(datePart);
                            if (!d.isBefore(cutoff)) dates.add(d);
                        } catch (Exception ignored) {}
                    });
        }

        return dates.stream()
                .sorted(Comparator.reverseOrder())
                .map(LocalDate::toString)
                .collect(Collectors.toList());
    }

    /**
     * Live follow for any source â€” tails the active log file.
     */
    public FollowSession followLogsForSource(String source, String subType,
                                             LogFormat format, String sessionId,
                                             Consumer<String> consumer) throws IOException {
        log.info("Starting log follow session sessionId={} source={} subType={} format={}",
                sessionId, source, subType, format);
        Path file = resolveActivePath(source, subType, format);
        if (!Files.exists(file)) {
            log.warn("followLogsForSource: log file not found {}", file);
            throw new FileNotFoundException("Log file not found: " + file);
        }

        FollowSession session = new FollowSession(sessionId, source, subType, format, file, consumer);
        followSessions.put(sessionId, session);

        Thread t = startFollowThread(file, consumer, sessionId);
        session.setThread(t);
        return session;
    }

    public void stopFollowing(String sessionId) {
        log.debug("stopFollowing sessionId={}", sessionId);
        FollowSession s = followSessions.remove(sessionId);
        if (s != null && s.getThread() != null) s.getThread().interrupt();
    }

    // =====================================================================
    // PATH RESOLUTION
    // =====================================================================

    Path resolveActivePath(String source, String subType, LogFormat format) {
        return switch (source.toLowerCase()) {
            case "app" -> {
                String ext = (format == LogFormat.JSON) ? ".json" : ".log";
                yield props.getLogsPath().resolve("db-world-" + subType.toLowerCase() + ext);
            }
            case "nginx" -> props.getLogsPath().resolve("nginx")
                    .resolve(subType.toLowerCase() + ".log");
            case "aria2" -> props.getLogsPath().resolve("aria2").resolve("aria2.log");
            case "mysql" -> props.getLogsPath().resolve("mysql").resolve("mysql_backup.log");
            default -> throw new IllegalArgumentException("Unknown log source: " + source);
        };
    }

    private List<Path> resolveRotatedPaths(String source, String subType,
                                           LogFormat format, LocalDate date) throws IOException {
        if (!source.equalsIgnoreCase("app")) return Collections.emptyList();

        Path rotatedDir = props.getLogsPath().resolve("rotated").resolve("app");
        if (!Files.exists(rotatedDir)) return Collections.emptyList();

        String ext = (format == LogFormat.JSON) ? ".json.gz" : ".log.gz";
        String prefix = "db-world-" + subType.toLowerCase() + "-" + date;

        try (Stream<Path> stream = Files.list(rotatedDir)) {
            return stream
                    .filter(p -> {
                        String name = p.getFileName().toString();
                        return name.startsWith(prefix) && name.endsWith(ext);
                    })
                    .sorted()
                    .collect(Collectors.toList());
        }
    }

    // =====================================================================
    // READING
    // =====================================================================

    /** Efficient reverse-tail using ReversedLinesFileReader, returns chronological order */
    private List<String> tailLines(Path path, int max) throws IOException {
        List<String> result = new ArrayList<>(Math.min(max, 4096));
        // commons-io 2.20+ replaced the constructor with a builder; the old
        // ctor is @Deprecated and produces a warning under -Xlint:deprecation.
        try (ReversedLinesFileReader reader = ReversedLinesFileReader.builder()
                .setPath(path)
                .setBufferSize(BUFFER_SIZE)
                .setCharset(StandardCharsets.UTF_8)
                .get()) {
            String line;
            while ((line = reader.readLine()) != null && result.size() < max) {
                if (!line.isBlank()) result.add(line);
            }
        }
        Collections.reverse(result); // oldest -> newest
        return result;
    }

    private List<String> readGzip(Path path, int maxLines) throws IOException {
        List<String> lines = new ArrayList<>();
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(
                        new GZIPInputStream(Files.newInputStream(path)),
                        StandardCharsets.UTF_8), BUFFER_SIZE)) {
            String line;
            while ((line = reader.readLine()) != null && lines.size() < maxLines) {
                if (!line.isBlank()) lines.add(line);
            }
        }
        return lines;
    }

    // =====================================================================
    // RESPONSE BUILDING
    // =====================================================================

    private LogResponse buildResponse(LogType type, LogFormat format, List<String> lines) {
        if (format == LogFormat.RAW) return new LogResponse(lines, lines.size());

        LogLineParser<?> parser = appParsers.get(type);
        if (parser == null) throw new IllegalArgumentException("No parser for type: " + type);

        List<Object> parsed = new ArrayList<>(lines.size());
        int failures = 0;
        for (String line : lines) {
            try {
                parsed.add(parser.parse(line));
            } catch (Exception e) {
                failures++;
                if (failures <= 3) {
                    String sample = line.length() > 200 ? line.substring(0, 200) : line;
                    log.warn("Failed to parse {} log line (sample='{}')", type, sample, e);
                }
            }
        }
        if (failures > 0) {
            log.warn("Parsed {} of {} lines ({} failed) for type={}",
                    parsed.size(), lines.size(), failures, type);
        }
        return new LogResponse(parsed, parsed.size());
    }

    // =====================================================================
    // TIME FILTER
    // =====================================================================

    private List<String> filterByTimestampCutoff(List<String> lines, OffsetDateTime cutoff) {
        return lines.stream().filter(l -> isAfterCutoff(l, cutoff)).collect(Collectors.toList());
    }

    private boolean isAfterCutoff(String line, OffsetDateTime cutoff) {
        String ts = extractJsonTimestamp(line);
        if (ts == null) return true;
        try {
            return OffsetDateTime.parse(ts, LOG_TS_FORMAT).isAfter(cutoff);
        } catch (Exception e) {
            return true;
        }
    }

    private String extractJsonTimestamp(String line) {
        int idx = line.indexOf("\"timestamp\":\"");
        if (idx < 0) return null;
        int s = idx + 13;
        int e = line.indexOf('"', s);
        return (e < 0) ? null : line.substring(s, e);
    }

    // =====================================================================
    // LIVE FOLLOW
    // =====================================================================

    private Thread startFollowThread(Path path, Consumer<String> consumer, String sessionId) {
        Thread t = new Thread(() -> {
            RandomAccessFile raf = null;
            try {
                raf = new RandomAccessFile(path.toFile(), "r");
                long pointer = raf.length();

                while (!Thread.currentThread().isInterrupted()) {
                    long length = raf.length();
                    if (length < pointer) pointer = 0; // file rotated

                    if (length > pointer) {
                        raf.seek(pointer);
                        String line;
                        while ((line = raf.readLine()) != null) {
                            if (Thread.currentThread().isInterrupted()) break;
                            try {
                                consumer.accept(new String(line.getBytes(StandardCharsets.ISO_8859_1), StandardCharsets.UTF_8));
                            } catch (Exception e) {
                                Thread.currentThread().interrupt();
                                break;
                            }
                        }
                        pointer = raf.getFilePointer();
                    }

                    Thread.sleep(500);
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            } catch (IOException e) {
                log.error("Fatal IO in follow thread sessionId={}", sessionId, e);
            } finally {
                if (raf != null) try { raf.close(); } catch (IOException ignored) {}
                followSessions.remove(sessionId);
            }
        });

        t.setDaemon(true);
        t.setName("log-follow-" + sessionId.substring(0, Math.min(16, sessionId.length())));
        t.start();
        return t;
    }

    // =====================================================================
    // UTILITIES
    // =====================================================================

    private LogType parseLogType(String subType) {
        return switch (subType.toLowerCase()) {
            case "error"   -> LogType.ERROR;
            case "debug"   -> LogType.DEBUG;
            case "request" -> LogType.REQUEST;
            default        -> LogType.INFO;
        };
    }

    // =====================================================================
    // INNER CLASSES
    // =====================================================================

    public static class LogResponse {
        private final List<?> data;
        private final int count;
        private final boolean fileFound;

        public LogResponse(List<?> data, int count, boolean fileFound) {
            this.data = data;
            this.count = count;
            this.fileFound = fileFound;
        }
        /** Backward-compat: fileFound inferred from whether any data was returned */
        public LogResponse(List<?> data, int count) {
            this(data, count, count > 0);
        }
        public List<?> getData()      { return data; }
        public int getCount()         { return count; }
        public boolean isFileFound()  { return fileFound; }
    }

    public static class FollowSession {
        private final String sessionId;
        private final String source;
        private final String subType;
        private final LogFormat format;
        private final Path file;
        private final Consumer<String> consumer;
        private final long startTime = System.currentTimeMillis();
        private Thread thread;

        public FollowSession(String sessionId, String source, String subType,
                             LogFormat format, Path file, Consumer<String> consumer) {
            this.sessionId = sessionId;
            this.source = source;
            this.subType = subType;
            this.format = format;
            this.file = file;
            this.consumer = consumer;
        }

        public void setThread(Thread t)         { this.thread = t; }
        public Thread getThread()               { return thread; }
        public String getSessionId()            { return sessionId; }
        public String getSource()               { return source; }
        public String getSubType()              { return subType; }
        public LogFormat getFormat()            { return format; }
        public Path getFile()                   { return file; }
        public Consumer<String> getConsumer()   { return consumer; }
        public long getStartTime()              { return startTime; }
    }
}
