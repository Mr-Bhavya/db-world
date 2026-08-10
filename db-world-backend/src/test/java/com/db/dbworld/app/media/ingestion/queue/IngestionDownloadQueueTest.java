package com.db.dbworld.app.media.ingestion.queue;

import com.db.dbworld.app.media.ingestion.tracking.TrackingService;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

/**
 * The single-slot download queue's occupancy rules: plain FIFO, the release-to-parallel bypass
 * ({@link IngestionDownloadQueue#releaseNow}) and the post-review reprocess reclaim
 * ({@link IngestionDownloadQueue#enqueueForReprocess}), plus that the slot is only freed on
 * {@code signalComplete} (i.e. after the whole job, not after the download).
 */
class IngestionDownloadQueueTest {

    private final IngestionDownloadQueue queue = new IngestionDownloadQueue(mock(TrackingService.class));

    @Test
    void firstJobTakesTheSlotAndSecondWaits() {
        assertThat(queue.enqueue("A", false)).isTrue();
        assertThat(queue.getCurrentlyRunningJobId()).isEqualTo("A");

        assertThat(queue.enqueue("B", false)).isTrue();
        assertThat(queue.getCurrentlyRunningJobId()).isEqualTo("A"); // B still waiting
        assertThat(queue.getQueueSize()).isEqualTo(1);
        assertThat(queue.getPositionInQueue("B")).isEqualTo(1);
    }

    @Test
    void magnetBypassesTheQueue() {
        assertThat(queue.enqueue("magnet", true)).isFalse(); // false = start immediately, no slot
        assertThat(queue.getCurrentlyRunningJobId()).isNull();
    }

    @Test
    void slotIsFreedOnlyOnSignalComplete() {
        queue.enqueue("A", false);
        assertThat(queue.getCurrentlyRunningJobId()).isEqualTo("A");

        queue.signalComplete("A");
        assertThat(queue.getCurrentlyRunningJobId()).isNull();
        assertThat(queue.getQueueSize()).isZero();
    }

    @Test
    void releaseNowLetsAQueuedJobBypassTheSlot() throws Exception {
        queue.enqueue("A", false);          // takes the slot
        queue.enqueue("B", false);          // waits

        assertThat(queue.releaseNow("B")).isTrue();
        assertThat(queue.getQueueSize()).isZero();                 // B pulled out of the FIFO
        assertThat(queue.getCurrentlyRunningJobId()).isEqualTo("A"); // A keeps the slot
        assertThat(queue.isParallel("B")).isTrue();                // flagged for parallel processing too

        // B now runs in parallel: awaitTurn returns without B ever taking the slot, and the flag
        // persists (so the pipeline can also bypass the serial processing cap).
        assertThat(queue.awaitTurn("B", () -> false)).isTrue();
        assertThat(queue.getCurrentlyRunningJobId()).isEqualTo("A");
        assertThat(queue.isParallel("B")).isTrue();
    }

    @Test
    void releaseNowIsANoOpForTheRunningOrUnknownJob() {
        queue.enqueue("A", false);
        assertThat(queue.releaseNow("A")).isFalse();   // already holds the slot
        assertThat(queue.releaseNow("ghost")).isFalse(); // never queued
        assertThat(queue.getCurrentlyRunningJobId()).isEqualTo("A");
    }

    @Test
    void reprocessReclaimJumpsAheadOfWaitingDownloads() {
        queue.enqueue("A", false);              // takes the slot
        queue.enqueue("B", false);              // waits (FIFO tail)
        queue.enqueueForReprocess("C");         // post-review reclaim → front of the deque

        queue.signalComplete("A");              // free the slot → next should be C, not B
        assertThat(queue.getCurrentlyRunningJobId()).isEqualTo("C");

        queue.signalComplete("C");
        assertThat(queue.getCurrentlyRunningJobId()).isEqualTo("B");
    }

    @Test
    void cancelRemovesFromQueueAndFreesSlotWhenRunning() {
        queue.enqueue("A", false);
        queue.enqueue("B", false);

        queue.cancel("B");                      // waiting job → just drop it
        assertThat(queue.getQueueSize()).isZero();
        assertThat(queue.getCurrentlyRunningJobId()).isEqualTo("A");

        queue.cancel("A");                      // running job → free the slot
        assertThat(queue.getCurrentlyRunningJobId()).isNull();
    }
}
