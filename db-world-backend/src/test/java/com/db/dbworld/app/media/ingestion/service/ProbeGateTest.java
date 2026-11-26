package com.db.dbworld.app.media.ingestion.service;

import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ProbeGateTest {

    @Test
    void cachesSuccessfulResultsPerKey() {
        ProbeGate gate = new ProbeGate(2, Duration.ofSeconds(1), Duration.ofMinutes(1), 8);
        AtomicInteger calls = new AtomicInteger();

        assertThat(gate.run("k", calls::incrementAndGet)).isEqualTo(1);
        assertThat(gate.run("k", calls::incrementAndGet)).isEqualTo(1);
        assertThat(gate.run("other", calls::incrementAndGet)).isEqualTo(2);
    }

    @Test
    void doesNotCacheFailures() {
        ProbeGate gate = new ProbeGate(1, Duration.ofSeconds(1), Duration.ofMinutes(1), 8);
        AtomicInteger calls = new AtomicInteger();

        assertThatThrownBy(() -> gate.run("k", () -> {
            calls.incrementAndGet();
            throw new IllegalStateException("boom");
        })).hasMessage("boom");
        assertThat(gate.run("k", calls::incrementAndGet)).isEqualTo(2);
    }

    @Test
    void rejectsWhenAllSlotsStayBusy() throws Exception {
        ProbeGate gate = new ProbeGate(1, Duration.ofMillis(50), Duration.ofMinutes(1), 8);
        CountDownLatch started = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);

        Thread holder = Thread.ofVirtual().start(() -> gate.run("slow", () -> {
            started.countDown();
            release.await();
            return 1;
        }));
        started.await();

        assertThatThrownBy(() -> gate.run("fast", () -> 2))
                .isInstanceOf(YtFormatService.YtProbeException.class)
                .hasMessageContaining("busy");

        release.countDown();
        holder.join();
        assertThat(gate.run("fast", () -> 2)).isEqualTo(2);
    }
}
