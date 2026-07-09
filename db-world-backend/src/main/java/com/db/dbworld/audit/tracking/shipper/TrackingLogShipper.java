package com.db.dbworld.audit.tracking.shipper;

import com.db.dbworld.app.admin.config.registry.ConfigKeys;
import com.db.dbworld.app.admin.config.service.SettingsService;
import com.db.dbworld.audit.tracking.aggregate.NginxTickAggregate;
import com.db.dbworld.audit.tracking.config.TrackingProperties;
import com.db.dbworld.audit.tracking.ingest.TrackingIngestService;
import com.db.dbworld.audit.tracking.parse.CdnLogLine;
import com.db.dbworld.audit.tracking.parse.CdnLogLineParser;
import com.db.dbworld.infrastructure.logging.backoff.FailureBackoff;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.nio.file.attribute.BasicFileAttributes;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * Tails the nginx CDN JSON access log (Plan 1B source of truth for browser/IDM/1DM/external
 * transfers), parses each line, groups by {@code request_id} into {@link NginxTickAggregate}s,
 * and hands each off to {@link TrackingIngestService}.
 *
 * <p>This shipper reads the SAME {@code cdn_access.log} as the older
 * {@link com.db.dbworld.audit.activity.shipper.LogShipperService}, concurrently. That is safe:
 * both are read-only on the file and keep independent offset state in separate tables
 * ({@code TRACKING_LOG_SHIPPER_STATE} vs {@code LOG_SHIPPER_STATE}).
 *
 * <h3>Resilience (mirrors {@code LogShipperService})</h3>
 * <ul>
 *   <li><b>Restart-safe.</b> {@link TrackingShipperStateEntity} holds the last committed byte
 *       offset; the shipper seeks there and resumes on startup.</li>
 *   <li><b>Rotation-safe.</b> A file "marker" (NIO {@code fileKey} hash, a proxy for inode)
 *       changing means logrotate replaced the file. Any leftover rotated file
 *       ({@code path + rotatedSuffix}) is drained first, then we continue at offset 0 on the
 *       new current file.</li>
 *   <li><b>Truncation-safe.</b> If file size &lt; saved offset, the offset resets to 0.</li>
 *   <li><b>Crash-safe.</b> The offset is advanced/persisted only AFTER all ingest calls for the
 *       tick complete, and only past complete lines (a trailing partial line is left unconsumed).
 *       A crash mid-tick simply re-reads the same lines next tick.</li>
 *   <li><b>Fresh-install.</b> Starts at end-of-file so history is not replayed; an operator can
 *       opt into backfill by manually setting {@code byte_offset = 0} in the DB.</li>
 * </ul>
 */
@Log4j2
@Component
@RequiredArgsConstructor
public class TrackingLogShipper {

    /** Startup-bound infra paths only — cdn-log-path + rotated-suffix stay in YAML. */
    private final TrackingProperties props;
    private final SettingsService settings;
    private final TrackingShipperStateRepository stateRepo;
    private final CdnLogLineParser parser;
    private final NginxTickBuilder nginxTickBuilder;
    private final TrackingIngestService trackingIngestService;

    /** Mirrors LogShipperService's tick-level backoff; keeps failure logs from flooding. */
    private final FailureBackoff tickFailureBackoff = FailureBackoff.defaults();

    // Hardcoded to the tracking.batch-tick-ms catalog default (5000ms). This value only sets
    // the schedule cadence itself (no runtime decision depends on it), and the
    // "${dbworld.tracking.batch-tick-ms}" YAML key it used to read is removed once the key
    // moves fully to the DB-backed catalog — a literal here keeps boot from depending on it.
    @Scheduled(fixedDelay = 5000L)
    public void tick() {
        if (!settings.getBoolean(ConfigKeys.TRACKING_ENABLED)) return;
        if (!tickFailureBackoff.shouldAttempt()) return;
        try {
            runOneTick();
            tickFailureBackoff.recordSuccess();
        } catch (Exception ex) {
            int streak = tickFailureBackoff.recordFailure();
            if (tickFailureBackoff.shouldLogWarn()) {
                log.error("TrackingLogShipper tick failed (consecutive={}): {}", streak, ex.getMessage(), ex);
            } else {
                log.debug("TrackingLogShipper tick failed (consecutive={}): {}", streak, ex.getMessage());
            }
        }
    }

    private void runOneTick() throws IOException {
        String cdnLogPath = props.getCdnLogPath();
        if (cdnLogPath == null || cdnLogPath.isBlank()) {
            log.debug("TrackingLogShipper: cdn-log-path not configured; skipping tick");
            return;
        }

        Path path = Paths.get(cdnLogPath);
        if (!Files.exists(path)) {
            log.debug("TrackingLogShipper: cdn access log not present at {}", path);
            return;
        }

        TrackingShipperStateEntity state = loadOrInitState(path);

        long currentMarker = fileMarker(path);
        long currentSize = Files.size(path);
        long offset = state.getByteOffset();

        // 1. Rotation: marker changed since last tick.
        if (state.getInode() != 0L && currentMarker != state.getInode()) {
            Path rotated = path.resolveSibling(path.getFileName().toString() + props.getRotatedSuffix());
            if (Files.exists(rotated)) {
                Result rotatedResult = readAndIngest(rotated, offset, Long.MAX_VALUE);
                log.info("TrackingLogShipper: rotation detected; processed {} lines from {}",
                        rotatedResult.linesProcessed, rotated.getFileName());
            }
            offset = 0L;
        }

        // 2. Truncation: file shrank below saved offset.
        if (currentSize < offset) {
            log.warn("TrackingLogShipper: log truncated (size={}, savedOffset={}); resetting to 0",
                    currentSize, offset);
            offset = 0L;
        }

        // 3. Read forward, bounded by maxBytesPerTick.
        Result r = readAndIngest(path, offset, settings.getLong(ConfigKeys.TRACKING_MAX_BYTES_PER_TICK));

        // 4. Advance + persist state ONLY after ingest calls for this tick complete.
        state.setInode(currentMarker);
        state.setByteOffset(r.newOffset);
        state.setLastProcessedAt(Instant.now());
        state.setFilePath(cdnLogPath);
        stateRepo.save(state);

        if (r.linesProcessed > 0 || r.ticksIngested > 0) {
            log.info("TrackingLogShipper: tick processed {} lines, {} sessions ingested ({}..{}={} bytes)",
                    r.linesProcessed, r.ticksIngested, offset, r.newOffset, r.newOffset - offset);
        }
    }

    /**
     * Reads up to {@code maxBytes} bytes starting at {@code startOffset}, parses complete lines
     * only (a trailing partial line is left unconsumed and its bytes are not counted toward the
     * returned offset), builds per-session {@link NginxTickAggregate}s, and ingests each one.
     */
    private Result readAndIngest(Path path, long startOffset, long maxBytes) throws IOException {
        List<CdnLogLine> lines = new ArrayList<>();
        long offset = startOffset;
        long bytesRead = 0L;
        long linesProcessed = 0L;

        try (FileChannel ch = FileChannel.open(path, StandardOpenOption.READ)) {
            ch.position(startOffset);
            ByteBuffer buf = ByteBuffer.allocate(64 * 1024);
            ByteArrayOutputStream lineBuf = new ByteArrayOutputStream();

            outer:
            while (ch.read(buf) > 0) {
                buf.flip();
                while (buf.hasRemaining()) {
                    byte b = buf.get();
                    bytesRead++;
                    if (b == (byte) '\n') {
                        offset += lineBuf.size() + 1; // include the \n
                        String line = lineBuf.toString(StandardCharsets.UTF_8);
                        lineBuf.reset();
                        if (!line.isEmpty()) {
                            linesProcessed++;
                            Optional<CdnLogLine> parsed = parser.parse(line);
                            parsed.ifPresent(lines::add);
                            if (lines.size() >= settings.getInt(ConfigKeys.TRACKING_MAX_ACCUMULATOR_ENTRIES)) break outer;
                        }
                    } else if (b != (byte) '\r') {
                        lineBuf.write(b);
                    }
                }
                buf.clear();
                if (bytesRead >= maxBytes) break;
            }
            // Partial line at EOF stays unconsumed — its bytes are not added to offset.
        }

        List<NginxTickAggregate> ticks = nginxTickBuilder.build(lines);
        for (NginxTickAggregate t : ticks) {
            trackingIngestService.ingestNginxTick(t);
        }

        return new Result(offset, linesProcessed, ticks.size());
    }

    private TrackingShipperStateEntity loadOrInitState(Path path) {
        return stateRepo.findById((byte) 1).orElseGet(() -> {
            TrackingShipperStateEntity fresh = new TrackingShipperStateEntity();
            fresh.setId((byte) 1);
            fresh.setFilePath(path.toString());
            // Start at end-of-file on fresh install; operator opts in to backfill by
            // manually setting byte_offset = 0 in the DB.
            try {
                fresh.setByteOffset(Files.exists(path) ? Files.size(path) : 0L);
                fresh.setInode(Files.exists(path) ? fileMarker(path) : 0L);
            } catch (IOException ex) {
                fresh.setByteOffset(0L);
                fresh.setInode(0L);
            }
            return stateRepo.save(fresh);
        });
    }

    /** A stable marker that changes when the file is replaced. Uses NIO {@code fileKey()}
     *  (typically wraps the inode on Linux) hashed to a long. */
    private static long fileMarker(Path path) throws IOException {
        BasicFileAttributes a = Files.readAttributes(path, BasicFileAttributes.class);
        Object fk = a.fileKey();
        if (fk != null) return fk.toString().hashCode();
        return a.creationTime().toMillis();
    }

    private record Result(long newOffset, long linesProcessed, int ticksIngested) {}
}
