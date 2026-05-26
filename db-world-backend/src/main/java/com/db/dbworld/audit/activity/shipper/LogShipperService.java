package com.db.dbworld.audit.activity.shipper;

import com.db.dbworld.audit.activity.repository.UserCinemaActivityRepository;
import com.db.dbworld.audit.activity.shipper.DownloadAccumulator.Aggregate;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

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
import java.time.Instant;
import java.util.Optional;

/**
 * Tails the nginx CDN JSON access log, aggregates per {@code download_id}, and flushes
 * UPDATEs to {@code user_cinema_activity}. Single-threaded, runs every {@code batch-tick-ms}.
 *
 * <h3>Resilience</h3>
 * <ul>
 *   <li><b>Restart-safe.</b> {@link LogShipperStateEntity} holds the last successfully
 *       committed byte offset. On startup the shipper seeks there and resumes.</li>
 *   <li><b>Rotation-safe.</b> File "marker" (NIO {@code fileKey} hash, a proxy for inode)
 *       changes when logrotate replaces the file. The shipper finishes any leftover
 *       {@code .1} file, then switches to the new current file at offset 0.</li>
 *   <li><b>Truncation-safe.</b> If file size &lt; saved offset, we reset to 0.</li>
 *   <li><b>Idempotent.</b> All UPDATEs use absolute values; counters are bumped only on
 *       the first STARTED/IN_PROGRESS → COMPLETED transition (guarded at SQL level).</li>
 *   <li><b>Crash-safe.</b> Offset is advanced only AFTER the UPDATEs commit. A crash
 *       between flush and offset-save re-reads the same lines next tick (idempotent).</li>
 * </ul>
 *
 * <h3>What it doesn't do</h3>
 * The shipper never creates or deletes rows — it only updates rows previously inserted
 * by {@code /resolve}. Lines whose {@code download_id} has no matching row are silently
 * dropped (this happens for static-asset requests like {@code /favicon.ico}).
 */
@Log4j2
@Service
@RequiredArgsConstructor
public class LogShipperService {

    private final LogShipperProperties        props;
    private final LogShipperStateRepository   stateRepo;
    private final UserCinemaActivityRepository activityRepo;
    private final LogLineParser               parser;

    /** Self-injected handle so @Transactional aspect wraps the flush call. */
    @Autowired
    private LogShipperService self;

    @Scheduled(fixedDelayString = "${dbworld.log-shipper.batch-tick-ms:5000}")
    public void tick() {
        if (!props.isEnabled()) return;
        try {
            runOneTick();
        } catch (Exception ex) {
            log.error("LogShipperService tick failed", ex);
        }
    }

    private void runOneTick() throws IOException {
        Path path = Paths.get(props.getLogFilePath());
        if (!Files.exists(path)) {
            log.warn("LogShipperService: log file not found: {}", path);
            return;
        }

        LogShipperStateEntity state = loadOrInitState();

        long currentMarker = fileMarker(path);
        long currentSize   = Files.size(path);
        long offset        = state.getByteOffset();

        // 1. Rotation: marker changed since last tick.
        if (state.getInode() != 0L && currentMarker != state.getInode()) {
            Path rotated = path.resolveSibling(path.getFileName().toString() + props.getRotatedSuffix());
            if (Files.exists(rotated)) {
                Result rotatedResult = readAndFlush(rotated, offset, Long.MAX_VALUE);
                log.info("LogShipperService: rotation detected; processed {} lines from {}",
                        rotatedResult.linesProcessed, rotated.getFileName());
            }
            offset = 0L;
        }

        // 2. Truncation: file shrank below saved offset.
        if (currentSize < offset) {
            log.warn("LogShipperService: log truncated (size={}, savedOffset={}); resetting to 0",
                    currentSize, offset);
            offset = 0L;
        }

        // 3. Read forward.
        Result r = readAndFlush(path, offset, props.getMaxBytesPerTick());

        // 4. Advance state ONLY after flush commits.
        state.setInode(currentMarker);
        state.setByteOffset(r.newOffset);
        state.setLastProcessedAt(Instant.now());
        state.setFilePath(props.getLogFilePath());
        stateRepo.save(state);

        if (r.linesProcessed > 0 || r.updatesApplied > 0) {
            log.info("LogShipperService: tick processed {} lines, {} downloads aggregated, {} rows updated ({}..{}={} bytes)",
                    r.linesProcessed, r.downloadsAggregated, r.updatesApplied,
                    offset, r.newOffset, r.newOffset - offset);
        }
    }

    /** Reads up to {@code maxBytes} bytes starting at {@code startOffset}, parses complete lines,
     *  aggregates, and flushes. Returns the new offset (advanced only past complete lines). */
    private Result readAndFlush(Path path, long startOffset, long maxBytes) throws IOException {
        DownloadAccumulator acc = new DownloadAccumulator();
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
                            Optional<LogLineParser.LogLineEvent> ev = parser.parse(line);
                            ev.ifPresent(acc::accept);
                            if (acc.size() >= props.getMaxAccumulatorEntries()) break outer;
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

        int updates = self.flush(acc);
        return new Result(offset, linesProcessed, acc.size(), updates);
    }

    /**
     * Flushes the aggregated updates in a single transaction so a crash mid-flush rolls
     * back; the next tick re-reads the same lines and applies the same absolute values
     * (idempotent).
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public int flush(DownloadAccumulator acc) {
        if (acc.size() == 0) return 0;
        int updates = 0;
        for (Aggregate a : acc.snapshot().values()) {
            int rowsAffected = activityRepo.updateFromShipper(
                    a.downloadId(),
                    a.bytesTransferred(),
                    a.fileSize(),
                    a.completionPercent(),
                    a.avgSpeedBps(),
                    a.connectionCount(),
                    a.clientType().name(),
                    a.remoteAddr(),
                    a.lastUpdated(),
                    a.completionStatus().name()
            );
            updates += rowsAffected;
        }
        return updates;
    }

    private LogShipperStateEntity loadOrInitState() {
        return stateRepo.findById((byte) 1).orElseGet(() -> {
            LogShipperStateEntity fresh = new LogShipperStateEntity();
            fresh.setId((byte) 1);
            fresh.setFilePath(props.getLogFilePath());
            // Start at end-of-file on fresh install; operator opts in to backfill by
            // manually setting byte_offset = 0 in the DB.
            try {
                Path p = Paths.get(props.getLogFilePath());
                fresh.setByteOffset(Files.exists(p) ? Files.size(p) : 0L);
                fresh.setInode(Files.exists(p) ? fileMarker(p) : 0L);
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

    private record Result(long newOffset, long linesProcessed, int downloadsAggregated, int updatesApplied) {}
}
