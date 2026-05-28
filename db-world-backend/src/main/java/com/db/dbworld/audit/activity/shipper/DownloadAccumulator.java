package com.db.dbworld.audit.activity.shipper;

import com.db.dbworld.audit.activity.entity.UserCinemaActivityEntity.ActivityType;
import com.db.dbworld.audit.activity.entity.UserCinemaActivityEntity.ClientType;
import com.db.dbworld.audit.activity.entity.UserCinemaActivityEntity.CompletionStatus;
import com.db.dbworld.audit.activity.shipper.LogLineParser.LogLineEvent;
import com.db.dbworld.audit.activity.util.UserAgentClassifier;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Accumulates parsed log lines per {@code download_id} and produces one aggregate
 * record per id when {@link #snapshot()} is called.
 *
 * <p>Aggregation rules:
 * <ul>
 *   <li>{@code bytes_transferred} = union of byte intervals seen across all lines
 *       for this download_id (range-merged to avoid double-counting overlapping
 *       range requests retried by streaming players).</li>
 *   <li>{@code completion_percent} = unique-bytes / file_size, where file_size
 *       is taken from any Content-Range header encountered (status 206).</li>
 *   <li>{@code avg_speed_bps} = sum(bytes_sent) / sum(duration_sec).</li>
 *   <li>{@code connection_count} = peak overlap among requests' time intervals
 *       (sweep-line algorithm).</li>
 *   <li>{@code completion_status} = COMPLETED when unique-bytes ≥ file_size and
 *       file_size is known; otherwise IN_PROGRESS.</li>
 *   <li>{@code client_type} = derived from latest user_agent via
 *       {@link UserAgentClassifier}.</li>
 *   <li>{@code remote_addr} = log's {@code real_ip} (Cloudflare-aware).</li>
 * </ul>
 *
 * <p>Not thread-safe — owned by a single shipper thread per tick.
 */
public class DownloadAccumulator {

    private static final Pattern CONTENT_RANGE = Pattern.compile("bytes\\s+(\\d+)-(\\d+)/(\\d+)");

    private final Map<String, Stats> states = new LinkedHashMap<>();

    public void accept(LogLineEvent e) {
        states.computeIfAbsent(e.downloadId(), k -> new Stats()).accept(e);
    }

    public int size() {
        return states.size();
    }

    public Map<String, Aggregate> snapshot() {
        Map<String, Aggregate> out = new LinkedHashMap<>(states.size());
        states.forEach((id, s) -> out.put(id, s.toAggregate(id)));
        return out;
    }

    public void clear() {
        states.clear();
    }

    /* ============================================================== */

    /** One download_id's rolling state. */
    private static final class Stats {
        final List<long[]> byteIntervals = new ArrayList<>();      // each: [start, end] inclusive
        final List<long[]> requestTimes  = new ArrayList<>();      // each: [startEpochMs, endEpochMs]
        long   sumBytesSent   = 0L;
        double sumDurationSec = 0.0;
        Instant maxTime       = null;
        Long   fileSize       = null;
        String latestType     = null;
        String latestUserAgent = null;
        String latestRealIp   = null;

        void accept(LogLineEvent e) {
            sumBytesSent += Math.max(0L, e.bytesSent());
            sumDurationSec += Math.max(0.0, e.durationSec());
            if (maxTime == null || e.time().isAfter(maxTime)) maxTime = e.time();
            if (e.type() != null) latestType = e.type();
            if (e.userAgent() != null && !e.userAgent().isBlank()) latestUserAgent = e.userAgent();
            if (e.realIp() != null && !e.realIp().isBlank()) latestRealIp = e.realIp();

            addCoverageInterval(e);
            addRequestTimeInterval(e);
        }

        private void addCoverageInterval(LogLineEvent e) {
            String cr = e.contentRange();
            if (cr != null && !cr.isBlank()) {
                Matcher m = CONTENT_RANGE.matcher(cr);
                if (m.matches()) {
                    try {
                        long start = Long.parseLong(m.group(1));
                        long end   = Long.parseLong(m.group(2));
                        long total = Long.parseLong(m.group(3));
                        if (end >= start) byteIntervals.add(new long[] { start, end });
                        if (fileSize == null || total > fileSize) fileSize = total;
                    } catch (NumberFormatException ignored) { /* skip line */ }
                    return;
                }
            }
            if (e.status() == 200 && e.bytesSent() > 0) {
                byteIntervals.add(new long[] { 0L, e.bytesSent() - 1 });
            }
        }

        private void addRequestTimeInterval(LogLineEvent e) {
            if (e.requestId() == null || e.requestId().isBlank()) return;
            long endMs   = e.time().toEpochMilli();
            long startMs = endMs - (long) (e.durationSec() * 1000.0);
            if (startMs > endMs) startMs = endMs;
            requestTimes.add(new long[] { startMs, endMs });
        }

        Aggregate toAggregate(String downloadId) {
            long uniqueBytes = mergedCoverage(byteIntervals);
            BigDecimal pct = (fileSize != null && fileSize > 0)
                    ? BigDecimal.valueOf(uniqueBytes * 100.0 / fileSize)
                            .setScale(2, RoundingMode.HALF_UP)
                            .min(BigDecimal.valueOf(100))
                    : null;

            Long avgBps = sumDurationSec > 0.0
                    ? (long) (sumBytesSent / sumDurationSec)
                    : null;

            int connectionCount = peakOverlap(requestTimes);

            ActivityType activityType = "DOWNLOAD".equals(latestType)
                    ? ActivityType.DOWNLOAD
                    : ActivityType.STREAM;

            ClientType clientType = UserAgentClassifier.classify(latestUserAgent);

            boolean completed = fileSize != null && uniqueBytes >= fileSize;
            CompletionStatus status = completed ? CompletionStatus.COMPLETED : CompletionStatus.IN_PROGRESS;

            return new Aggregate(
                    downloadId,
                    activityType,
                    uniqueBytes,
                    fileSize,
                    pct,
                    avgBps,
                    Math.max(1, connectionCount),
                    clientType,
                    latestRealIp,
                    maxTime != null ? maxTime : Instant.now(),
                    status
            );
        }
    }

    /** Merge inclusive intervals and return the total covered length. */
    static long mergedCoverage(List<long[]> intervals) {
        if (intervals.isEmpty()) return 0L;
        List<long[]> sorted = new ArrayList<>(intervals);
        sorted.sort((a, b) -> Long.compare(a[0], b[0]));
        long covered = 0L;
        long curStart = sorted.get(0)[0];
        long curEnd   = sorted.get(0)[1];
        for (int i = 1; i < sorted.size(); i++) {
            long[] iv = sorted.get(i);
            if (iv[0] <= curEnd + 1) {
                if (iv[1] > curEnd) curEnd = iv[1];
            } else {
                covered += (curEnd - curStart + 1);
                curStart = iv[0];
                curEnd   = iv[1];
            }
        }
        covered += (curEnd - curStart + 1);
        return covered;
    }

    /** Peak number of intervals overlapping at any single point in time. */
    static int peakOverlap(List<long[]> timeIntervals) {
        if (timeIntervals.isEmpty()) return 0;
        long[] starts = new long[timeIntervals.size()];
        long[] ends   = new long[timeIntervals.size()];
        for (int i = 0; i < timeIntervals.size(); i++) {
            starts[i] = timeIntervals.get(i)[0];
            ends[i]   = timeIntervals.get(i)[1];
        }
        java.util.Arrays.sort(starts);
        java.util.Arrays.sort(ends);
        int peak = 0, current = 0, si = 0, ei = 0;
        while (si < starts.length) {
            if (starts[si] <= ends[ei]) {
                current++;
                if (current > peak) peak = current;
                si++;
            } else {
                current--;
                ei++;
            }
        }
        return peak;
    }

    /** Aggregated update payload for one download_id. */
    public record Aggregate(
            String downloadId,
            ActivityType activityType,
            long bytesTransferred,
            Long fileSize,
            BigDecimal completionPercent,
            Long avgSpeedBps,
            int connectionCount,
            ClientType clientType,
            String remoteAddr,
            Instant lastUpdated,
            CompletionStatus completionStatus
    ) {}
}
