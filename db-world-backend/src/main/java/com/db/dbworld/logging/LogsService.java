package com.db.dbworld.logging;

import com.db.dbworld.logging.dto.LogFormat;
import com.db.dbworld.logging.dto.LogType;
import com.db.dbworld.logging.parser.*;
import com.db.dbworld.utils.DbWorldRuntimeProperties;
import org.springframework.stereotype.Service;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Consumer;
import java.util.zip.GZIPInputStream;

@Service
public class LogsService {

    private final DbWorldRuntimeProperties props;
    private final Map<LogType, LogLineParser<?>> parsers;
    private final Map<String, FollowSession> followSessions = new ConcurrentHashMap<>();

    private static final DateTimeFormatter LOG_TS_FORMAT =
            DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSSZ");
    private static final int DEFAULT_MAX_LINES = 5000;
    private static final int BUFFER_SIZE = 8192;

    public LogsService(DbWorldRuntimeProperties props) {
        this.props = props;
        this.parsers = initializeParsers();
    }

    private Map<LogType, LogLineParser<?>> initializeParsers() {
        Map<LogType, LogLineParser<?>> map = new EnumMap<>(LogType.class);
        map.put(LogType.ERROR, new ErrorLogParser());
        map.put(LogType.DEBUG, new DebugLogParser());
        map.put(LogType.INFO, new InfoLogParser());
        map.put(LogType.REQUEST, new RequestLogParser());
        return Collections.unmodifiableMap(map);
    }

    // =====================================================
    // PUBLIC API
    // =====================================================

    /**
     * Get logs with flexible query parameters
     * Supports lines (last N lines) or minutes (last N minutes)
     */
    public LogResponse getLogs(
            LogType type,
            LogFormat format,
            Integer lines,
            Integer minutes
    ) throws IOException {

        Path file = resolveLogPath(type, format);
        if (!Files.exists(file)) {
            return new LogResponse(Collections.emptyList(), 0);
        }

        List<String> rawLines;
        boolean isGzip = isGzip(file);

        if (minutes != null && minutes > 0) {
            // Time-based query
            int maxScanLines = lines != null ? lines : DEFAULT_MAX_LINES;
            rawLines = getLogsByTime(file, isGzip, minutes, maxScanLines);
        } else {
            // Line-based query
            int requestedLines = lines != null ? lines : DEFAULT_MAX_LINES;
            rawLines = getLogsByLines(file, isGzip, requestedLines);
        }

        return convertToResponse(type, format, rawLines);
    }

    /**
     * Stream live logs (Server-Sent Events support)
     */
    // In LogsService.java - Updated followLogs method

    public FollowSession followLogs(
            LogType type,
            LogFormat format,
            String sessionId,
            Consumer<String> consumer
    ) throws IOException {

        Path file = resolveLogPath(type, format);
        if (!Files.exists(file)) {
            throw new FileNotFoundException("Log file not found: " + file);
        }

        FollowSession session = new FollowSession(sessionId, type, format, file, consumer);
        followSessions.put(sessionId, session);

        Thread follower = startFollowThread(file, consumer, sessionId);
        session.setThread(follower);

        return session;
    }

    private Thread startFollowThread(Path path, Consumer<String> consumer, String sessionId) {
        Thread thread = new Thread(() -> {
            RandomAccessFile raf = null;
            try {
                raf = new RandomAccessFile(path.toFile(), "r");
                long filePointer = raf.length();

                while (!Thread.currentThread().isInterrupted()) {
                    try {
                        long fileLength = raf.length();

                        if (fileLength < filePointer) {
                            // File was rotated/truncated
                            filePointer = 0;
                        }

                        if (fileLength > filePointer) {
                            raf.seek(filePointer);
                            String line;
                            while ((line = raf.readLine()) != null) {
                                if (!Thread.currentThread().isInterrupted()) {
                                    try {
                                        consumer.accept(line);
                                    } catch (Exception e) {
                                        // Consumer failed (client disconnected)
                                        Thread.currentThread().interrupt();
                                        break;
                                    }
                                }
                            }
                            filePointer = raf.getFilePointer();
                        }

                        Thread.sleep(500);

                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                        break;
                    } catch (Exception e) {
                        // Log error but continue trying
                        System.err.println("Error in follow thread for session " + sessionId + ": " + e.getMessage());
                        try {
                            Thread.sleep(1000);
                        } catch (InterruptedException ie) {
                            Thread.currentThread().interrupt();
                            break;
                        }
                    }
                }
            } catch (IOException e) {
                System.err.println("Fatal error in follow thread for session " + sessionId + ": " + e.getMessage());
            } finally {
                // Clean up
                try {
                    if (raf != null) {
                        raf.close();
                    }
                } catch (IOException e) {
                    // Ignore
                }
                // Remove session
                followSessions.remove(sessionId);
                System.out.println("Follow thread ended for session: " + sessionId);
            }
        });

        thread.setDaemon(true);
        thread.setName("log-follower-" + sessionId);
        thread.start();
        return thread;
    }

    /**
     * Stop following logs
     */
    public void stopFollowing(String sessionId) {
        FollowSession session = followSessions.remove(sessionId);
        if (session != null && session.getThread() != null) {
            session.getThread().interrupt();
        }
    }

    // =====================================================
    // LOG RETRIEVAL STRATEGIES
    // =====================================================

    private List<String> getLogsByLines(Path file, boolean isGzip, int lines)
            throws IOException {
        if (isGzip) {
            return readGzipForward(file, lines);
        } else {
            return tailReverse(file, lines);
        }
    }

    private List<String> getLogsByTime(Path file, boolean isGzip, int minutes, int maxLines)
            throws IOException {

        OffsetDateTime cutoff = OffsetDateTime.now().minusMinutes(minutes);
        List<String> lines;

        if (isGzip) {
            // Gzip: read forward and filter
            lines = readGzipForward(file, maxLines);
        } else {
            // Plain text: reverse read and filter until cutoff
            lines = tailReverseWithTimeFilter(file, maxLines, cutoff);
        }

        // Apply time filter
        return filterByTimestampCutoff(lines, cutoff);
    }

    // =====================================================
    // PATH RESOLUTION
    // =====================================================

    private Path resolveLogPath(LogType type, LogFormat format) {
        String extension = getFileExtension(format);
        String filename = String.format("%s-%s%s",
                props.getAppName(),
                type.name().toLowerCase(),
                extension);
        return props.getLogsPath().resolve(filename);
    }

    private String getFileExtension(LogFormat format) {
        switch (format) {
            case JSON:
                return ".json";
            case RAW:
                return ".log";
            default:
                return ".log";
        }
    }

    // =====================================================
    // RESPONSE CONVERSION
    // =====================================================

    private LogResponse convertToResponse(LogType type, LogFormat format, List<String> lines) {
        if (format == LogFormat.RAW) {
            return new LogResponse(lines, lines.size());
        }

        LogLineParser<?> parser = parsers.get(type);
        if (parser == null) {
            throw new IllegalArgumentException("No parser configured for log type: " + type);
        }

        List<Object> parsedLogs = new ArrayList<>(lines.size());
        int validCount = 0;

        for (String line : lines) {
            try {
                Object parsed = parser.parse(line);
                parsedLogs.add(parsed);
                validCount++;
            } catch (Exception e) {
                // Skip malformed lines in JSON mode
                // In production, you might want to log these
            }
        }

        return new LogResponse(parsedLogs, validCount);
    }

    // =====================================================
    // FORWARD READING
    // =====================================================

    private List<String> readGzipForward(Path path, int maxLines) throws IOException {
        List<String> lines = new ArrayList<>();

        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(
                        new GZIPInputStream(Files.newInputStream(path)),
                        StandardCharsets.UTF_8
                ), BUFFER_SIZE)) {

            String line;
            while ((line = reader.readLine()) != null && lines.size() < maxLines) {
                lines.add(line);
            }
        }
        return lines;
    }

    // =====================================================
    // REVERSE TAIL (EFFICIENT)
    // =====================================================

    private List<String> tailReverse(Path path, int maxLines) throws IOException {
        try (RandomAccessFile raf = new RandomAccessFile(path.toFile(), "r")) {
            return readReverse(raf, maxLines, null);
        }
    }

    private List<String> tailReverseWithTimeFilter(
            Path path,
            int maxLines,
            OffsetDateTime cutoff) throws IOException {

        try (RandomAccessFile raf = new RandomAccessFile(path.toFile(), "r")) {
            return readReverse(raf, maxLines, cutoff);
        }
    }

    private List<String> readReverse(
            RandomAccessFile raf,
            int maxLines,
            OffsetDateTime cutoff) throws IOException {

        Deque<String> lines = new ArrayDeque<>();
        long fileLength = raf.length();

        if (fileLength == 0) {
            return Collections.emptyList();
        }

        StringBuilder sb = new StringBuilder();
        long pos = fileLength - 1;
        int lineCount = 0;
        boolean timeBoundReached = (cutoff == null);

        while (pos >= 0 && lineCount < maxLines && !timeBoundReached) {
            raf.seek(pos);
            int b = raf.read();

            if (b == '\n' || pos == 0) {
                if (pos == 0 && b != '\n') {
                    sb.append((char) b);
                }

                String line = sb.reverse().toString();
                sb.setLength(0);

                // Check time filter for JSON logs
                if (cutoff != null && !isLineAfterCutoff(line, cutoff)) {
                    timeBoundReached = true;
                    break;
                }

                lines.addFirst(line);
                lineCount++;
            } else {
                sb.append((char) b);
            }

            pos--;
        }

        return List.copyOf(lines);
    }

    // =====================================================
    // TIME FILTERING
    // =====================================================

    private List<String> filterByTimestampCutoff(List<String> lines, OffsetDateTime cutoff) {
        if (cutoff == null) {
            return lines;
        }

        List<String> filtered = new ArrayList<>();
        for (String line : lines) {
            if (isLineAfterCutoff(line, cutoff)) {
                filtered.add(line);
            }
        }
        return filtered;
    }

    private boolean isLineAfterCutoff(String line, OffsetDateTime cutoff) {
        String timestamp = extractTimestamp(line);
        if (timestamp == null) {
            return true; // Include lines without timestamps
        }

        try {
            OffsetDateTime lineTime = OffsetDateTime.parse(timestamp, LOG_TS_FORMAT);
            return lineTime.isAfter(cutoff);
        } catch (Exception e) {
            return true; // Include if timestamp parsing fails
        }
    }

    private String extractTimestamp(String line) {
        // Look for timestamp field in JSON
        int idx = line.indexOf("\"timestamp\":\"");
        if (idx < 0) return null;

        int start = idx + 13;
        int end = line.indexOf('"', start);
        if (end < 0) return null;

        return line.substring(start, end);
    }

    // =====================================================
    // LIVE FOLLOW (tail -f) with SSE support
    // =====================================================

    private Thread startFollowThread(Path path, Consumer<String> consumer) {
        Thread thread = new Thread(() -> {
            try (RandomAccessFile raf = new RandomAccessFile(path.toFile(), "r")) {
                long filePointer = raf.length();

                while (!Thread.currentThread().isInterrupted()) {
                    try {
                        long fileLength = raf.length();

                        if (fileLength < filePointer) {
                            // File was rotated/truncated
                            filePointer = 0;
                        }

                        if (fileLength > filePointer) {
                            raf.seek(filePointer);
                            String line;
                            while ((line = raf.readLine()) != null) {
                                if (!Thread.currentThread().isInterrupted()) {
                                    consumer.accept(line);
                                }
                            }
                            filePointer = raf.getFilePointer();
                        }

                        Thread.sleep(500);
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                        break;
                    } catch (Exception e) {
                        // Log error but continue trying
                        e.printStackTrace();
                        Thread.sleep(1000);
                    }
                }
            } catch (IOException | InterruptedException e) {
                e.printStackTrace();
            }
        });

        thread.setDaemon(true);
        thread.setName("log-follower-" + path.getFileName());
        thread.start();
        return thread;
    }

    // =====================================================
    // UTILITY METHODS
    // =====================================================

    private boolean isGzip(Path path) {
        String filename = path.toString().toLowerCase();
        return filename.endsWith(".gz") || filename.endsWith(".gzip");
    }

    // =====================================================
    // INNER CLASSES
    // =====================================================

    public static class LogResponse {
        private final List<?> data;
        private final int count;

        public LogResponse(List<?> data, int count) {
            this.data = data;
            this.count = count;
        }

        public List<?> getData() {
            return data;
        }

        public int getCount() {
            return count;
        }
    }

    public static class FollowSession {
        private final String sessionId;
        private final LogType type;
        private final LogFormat format;
        private final Path file;
        private final Consumer<String> consumer;
        private Thread thread;
        private final long startTime;

        public FollowSession(String sessionId, LogType type, LogFormat format,
                             Path file, Consumer<String> consumer) {
            this.sessionId = sessionId;
            this.type = type;
            this.format = format;
            this.file = file;
            this.consumer = consumer;
            this.startTime = System.currentTimeMillis();
        }

        public void setThread(Thread thread) {
            this.thread = thread;
        }

        public Thread getThread() {
            return thread;
        }

        public String getSessionId() {
            return sessionId;
        }

        public LogType getType() {
            return type;
        }

        public LogFormat getFormat() {
            return format;
        }

        public Path getFile() {
            return file;
        }

        public Consumer<String> getConsumer() {
            return consumer;
        }

        public long getStartTime() {
            return startTime;
        }
    }
}