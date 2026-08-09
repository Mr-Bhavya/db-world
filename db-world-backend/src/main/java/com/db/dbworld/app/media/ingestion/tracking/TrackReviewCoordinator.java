package com.db.dbworld.app.media.ingestion.tracking;

import com.db.dbworld.app.media.enrichment.TrackFilter;
import com.db.dbworld.app.media.ingestion.model.TrackReviewOptions;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Optional;
import java.util.concurrent.CancellationException;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

/**
 * Coordinates the interactive audio/subtitle track-review handshake.
 *
 * <p>When a job opts into track review, the pipeline (on a cheap virtual thread) calls
 * {@link #awaitSelection} <b>after the download completes but before it acquires a processing
 * slot</b>. The thread parks on a per-job future — holding no processing/download slot — so other
 * jobs keep flowing. The admin's {@code POST /tracks} completes it via {@link #submit}; a cancel
 * releases it via {@link #cancel}; otherwise it times out and the smart default is applied.
 */
@Log4j2
@Service
public class TrackReviewCoordinator {

    private final ConcurrentMap<String, Pending> pending = new ConcurrentHashMap<>();

    private record Pending(CompletableFuture<TrackFilter> future, TrackReviewOptions options) {}

    /**
     * Register the pending review and block the calling thread until a selection is submitted,
     * the job is cancelled, or the timeout elapses.
     *
     * @return the chosen filter; the {@code fallback} (smart default) on timeout; or {@code null}
     *         if the wait was cancelled (the caller should then finish the job as cancelled).
     */
    public TrackFilter awaitSelection(String jobId, TrackReviewOptions options,
                                      TrackFilter fallback, Duration timeout) {
        Pending p = new Pending(new CompletableFuture<>(), options);
        pending.put(jobId, p);
        try {
            return p.future.get(timeout.toMillis(), TimeUnit.MILLISECONDS);
        } catch (TimeoutException e) {
            log.info("[{}] Track review timed out after {} min — applying smart default",
                    jobId, timeout.toMinutes());
            return fallback;
        } catch (CancellationException e) {
            log.info("[{}] Track review cancelled while awaiting selection", jobId);
            return null;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.warn("[{}] Track review interrupted — applying smart default", jobId);
            return fallback;
        } catch (Exception e) {
            log.warn("[{}] Track review await failed ({}) — applying smart default", jobId, e.toString());
            return fallback;
        } finally {
            pending.remove(jobId);
        }
    }

    /** Apply the admin's selection, unparking the job. Returns false if it's no longer waiting. */
    public boolean submit(String jobId, TrackFilter chosen) {
        Pending p = pending.get(jobId);
        return p != null && p.future.complete(chosen);
    }

    /** Release a parked job so it can finish as cancelled. No-op if it isn't waiting. */
    public void cancel(String jobId) {
        Pending p = pending.get(jobId);
        if (p != null) p.future.cancel(true);
    }

    /** The detected tracks + smart default for a job currently awaiting selection. */
    public Optional<TrackReviewOptions> getOptions(String jobId) {
        Pending p = pending.get(jobId);
        return p != null ? Optional.of(p.options) : Optional.empty();
    }

    public boolean isPending(String jobId) {
        return pending.containsKey(jobId);
    }
}
