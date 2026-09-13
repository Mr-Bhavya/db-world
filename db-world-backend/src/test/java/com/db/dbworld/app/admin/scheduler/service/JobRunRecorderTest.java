package com.db.dbworld.app.admin.scheduler.service;

import com.db.dbworld.app.admin.scheduler.entity.SchedulerJobHistoryEntity;
import com.db.dbworld.app.admin.scheduler.entity.SchedulerJobHistoryEntity.TriggerSource;
import com.db.dbworld.app.admin.scheduler.repository.SchedulerJobHistoryRepository;
import com.db.dbworld.infrastructure.logging.mdc.MdcKeys;

import org.apache.logging.log4j.ThreadContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class JobRunRecorderTest {

    @Mock SchedulerJobHistoryRepository historyRepo;
    @InjectMocks JobRunRecorder recorder;

    @AfterEach
    void clearMdc() {
        ThreadContext.clearAll();
    }

    private SchedulerJobHistoryEntity captureSaved() {
        ArgumentCaptor<SchedulerJobHistoryEntity> captor =
                ArgumentCaptor.forClass(SchedulerJobHistoryEntity.class);
        verify(historyRepo).save(captor.capture());
        return captor.getValue();
    }

    @Test
    void successfulRun_recordsCountersAndNote() {
        recorder.run("TagScheduler", TriggerSource.SCHEDULED, null, summary -> {
            summary.count("strategiesRun", 7).count("ruleTagsFailed", 0).note("all good");
            return null;
        });

        SchedulerJobHistoryEntity saved = captureSaved();
        assertThat(saved.getJobName()).isEqualTo("TagScheduler");
        assertThat(saved.getStatus()).isEqualTo("SUCCESS");
        assertThat(saved.getMessage()).isNull();
        assertThat(saved.getRunId()).isNotBlank();
        assertThat(saved.getTriggeredBy()).isEqualTo(TriggerSource.SCHEDULED);
        assertThat(saved.getSummaryJson())
                .contains("\"strategiesRun\":7")
                .contains("\"ruleTagsFailed\":0")
                .contains("all good");
    }

    @Test
    void manualRun_recordsTheAdminWhoTriggeredIt() {
        recorder.run("MediaSync", TriggerSource.MANUAL, "admin@example.com", summary -> null);

        SchedulerJobHistoryEntity saved = captureSaved();
        assertThat(saved.getTriggeredBy()).isEqualTo(TriggerSource.MANUAL);
        assertThat(saved.getTriggeredByUser()).isEqualTo("admin@example.com");
    }

    /** A run that dies halfway should still show the work it completed. */
    @Test
    void failedRun_keepsPartialCounters_andRethrows() {
        assertThatThrownBy(() ->
                recorder.run("TmdbMovieSync", TriggerSource.SCHEDULED, null, summary -> {
                    summary.count("synced", 312);
                    throw new IllegalStateException("TMDB went away");
                }))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("TMDB went away");

        SchedulerJobHistoryEntity saved = captureSaved();
        assertThat(saved.getStatus()).isEqualTo("FAILED");
        assertThat(saved.getMessage()).isEqualTo("TMDB went away");
        assertThat(saved.getSummaryJson()).contains("\"synced\":312");
    }

    /** A checked exception has to surface too, not vanish into a swallowed cast. */
    @Test
    void failedRun_wrapsCheckedExceptions() {
        assertThatThrownBy(() ->
                recorder.run("MediaSync", TriggerSource.SCHEDULED, null, summary -> {
                    throw new java.io.IOException("disk gone");
                }))
                .isInstanceOf(IllegalStateException.class)
                .hasRootCauseMessage("disk gone");

        assertThat(captureSaved().getStatus()).isEqualTo("FAILED");
    }

    /** An exception with no message still has to name something in the history row. */
    @Test
    void failureWithoutMessage_fallsBackToTheExceptionType() {
        assertThatThrownBy(() ->
                recorder.run("MediaSync", TriggerSource.SCHEDULED, null, summary -> {
                    throw new NullPointerException();
                }))
                .isInstanceOf(NullPointerException.class);

        assertThat(captureSaved().getMessage()).isEqualTo("NullPointerException");
    }

    @Test
    void publishesRunIdToTheMdcForTheDurationOfTheRun() {
        String[] seen = new String[2];

        recorder.run("MediaSync", TriggerSource.SCHEDULED, null, summary -> {
            seen[0] = ThreadContext.get(MdcKeys.JOB_RUN_ID);
            seen[1] = ThreadContext.get(MdcKeys.JOB);
            return null;
        });

        assertThat(seen[0]).isNotBlank().isEqualTo(captureSaved().getRunId());
        assertThat(seen[1]).isEqualTo("MediaSync");
    }

    /**
     * A manual trigger runs while the admin's HTTP request context may still be on the thread.
     * The recorder must hand the slots back rather than clearing them.
     */
    @Test
    void restoresPreviousMdcValues_ratherThanClearingThem() {
        ThreadContext.put(MdcKeys.JOB, "OuterJob");
        ThreadContext.put(MdcKeys.TRACE_ID, "trace-123");

        recorder.run("MediaSync", TriggerSource.MANUAL, null, summary -> null);

        assertThat(ThreadContext.get(MdcKeys.JOB)).isEqualTo("OuterJob");
        assertThat(ThreadContext.get(MdcKeys.TRACE_ID)).isEqualTo("trace-123");
        assertThat(ThreadContext.get(MdcKeys.JOB_RUN_ID)).isNull();
    }

    @Test
    void runWithNoCountersOrNote_storesNoSummaryJson() {
        recorder.run("MediaSync", TriggerSource.SCHEDULED, null, summary -> null);

        assertThat(captureSaved().getSummaryJson()).isNull();
    }

    // ── Cancellation ─────────────────────────────────────────────────────────

    /** Runs {@code body} on another thread and waits for it to reach and leave the recorder. */
    private void runUntilCancelled(String jobId, CountDownLatch started) throws Exception {
        CountDownLatch done = new CountDownLatch(1);
        Thread worker = new Thread(() -> {
            try {
                recorder.run(jobId, TriggerSource.MANUAL, "admin@example.com", summary -> {
                    summary.count("synced", 12);
                    started.countDown();
                    Thread.sleep(10_000); // released by the interrupt that cancel() sends
                    return null;
                });
            } catch (Exception expected) {
                // The recorder rethrows; the caller decides, and here we do not care.
            } finally {
                done.countDown();
            }
        }, "test-" + jobId);
        worker.setDaemon(true);
        worker.start();

        assertThat(started.await(5, TimeUnit.SECONDS)).as("job should have started").isTrue();
        assertThat(recorder.cancel(jobId)).as("cancel should find the running job").isTrue();
        assertThat(done.await(5, TimeUnit.SECONDS)).as("job should have stopped").isTrue();
    }

    /** Someone pressing stop is not an incident, and must not be filed as a failure. */
    @Test
    void cancel_recordsTheRunAsCancelled_keepingItsPartialCounters() throws Exception {
        runUntilCancelled("TmdbMovieSync", new CountDownLatch(1));

        SchedulerJobHistoryEntity saved = captureSaved();
        assertThat(saved.getStatus()).isEqualTo("CANCELLED");
        assertThat(saved.getSummaryJson()).contains("\"synced\":12");
        assertThat(saved.getMessage()).contains("Cancelled");
    }

    @Test
    void cancel_returnsFalseWhenNothingIsRunning() {
        assertThat(recorder.cancel("TmdbMovieSync")).isFalse();
    }

    /** The live view is what lets the page show progress on a job still going. */
    @Test
    void exposesTheRunInFlight_withItsLiveCounters() throws Exception {
        AtomicLong progress = new AtomicLong(7);
        CountDownLatch started = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);

        Thread worker = new Thread(() -> {
            try {
                recorder.run("PersonSyncScheduler", TriggerSource.SCHEDULED, null, summary -> {
                    summary.progress(() -> Map.of("synced", progress.get()));
                    started.countDown();
                    release.await();
                    return null;
                });
            } catch (Exception ignored) {
                // not exercised here
            }
        }, "test-inflight");
        worker.setDaemon(true);
        worker.start();
        assertThat(started.await(5, TimeUnit.SECONDS)).isTrue();

        var inFlight = recorder.current("PersonSyncScheduler");
        assertThat(inFlight).isPresent();
        assertThat(inFlight.get().summary().liveCounters()).containsEntry("synced", 7L);
        progress.set(42);
        assertThat(inFlight.get().summary().liveCounters()).containsEntry("synced", 42L);

        release.countDown();
        worker.join(5_000);
        assertThat(recorder.current("PersonSyncScheduler")).isEmpty();
    }

    /**
     * Cron jobs run on a POOLED TaskScheduler thread. Handing one back still interrupted
     * would kill the next unrelated job that happened to land on it.
     */
    @Test
    void clearsTheInterruptFlagBeforeReleasingTheThread() throws Exception {
        CountDownLatch started = new CountDownLatch(1);
        AtomicBoolean stillInterrupted = new AtomicBoolean(true);
        CountDownLatch checked = new CountDownLatch(1);

        Thread worker = new Thread(() -> {
            try {
                recorder.run("TmdbTvSync", TriggerSource.MANUAL, null, summary -> {
                    started.countDown();
                    Thread.sleep(10_000);
                    return null;
                });
            } catch (Exception expected) {
                // rethrown by the recorder
            }
            stillInterrupted.set(Thread.currentThread().isInterrupted());
            checked.countDown();
        }, "test-interrupt");
        worker.setDaemon(true);
        worker.start();

        assertThat(started.await(5, TimeUnit.SECONDS)).isTrue();
        recorder.cancel("TmdbTvSync");
        assertThat(checked.await(5, TimeUnit.SECONDS)).isTrue();
        assertThat(stillInterrupted).isFalse();
    }

    /** History is bookkeeping — losing it must never take the job down with it. */
    @Test
    void historyWriteFailure_doesNotBreakTheJob() {
        when(historyRepo.save(org.mockito.ArgumentMatchers.any()))
                .thenThrow(new RuntimeException("db down"));

        String result = recorder.run("MediaSync", TriggerSource.SCHEDULED, null, summary -> "done");

        assertThat(result).isEqualTo("done");
    }
}
