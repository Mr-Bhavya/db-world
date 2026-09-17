package com.db.dbworld.app.system.info.collector;

import com.db.dbworld.app.system.info.collector.linux.LinuxServerInfoCollector;
import com.db.dbworld.app.system.info.dto.MemoryInfo;
import com.db.dbworld.core.processor.ProcessExecutor;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

/**
 * Regression coverage for {@link ServerInfoCollector}'s shared byte-formatting and JVM heap math.
 *
 * {@code ServerInfoCollector} is abstract, so a concrete collector ({@link LinuxServerInfoCollector})
 * is used to get an instance; {@code formatBytes(...)} is {@code protected}, and since this test class
 * lives in the same package as {@code ServerInfoCollector}, it's directly callable with no production
 * visibility change needed.
 */
class ServerInfoCollectorTest {

    private final ServerInfoCollector collector = new LinuxServerInfoCollector(mock(ProcessExecutor.class));

    /**
     * A collector with no OS-level memory source, so its generic totals <em>are</em> the heap.
     * Also the only one that inherits {@code getBasicMemoryInfo()} unchanged from the base class.
     */
    private final ServerInfoCollector heapOnly = new UnsupportedOSCollector(mock(ProcessExecutor.class));

    // ── formatBytes boundaries ──────────────────────────────────────────────────────

    @Test
    void formatBytes_zeroAndNegative_returnZeroBytes() {
        assertThat(collector.formatBytes(0)).isEqualTo("0 B");
        assertThat(collector.formatBytes(-1)).isEqualTo("0 B");
    }

    @Test
    void formatBytes_subKilobyte_staysInBytes() {
        assertThat(collector.formatBytes(512)).isEqualTo("512.00 B");
    }

    @Test
    void formatBytes_exactKilobyteBoundary() {
        assertThat(collector.formatBytes(1024)).isEqualTo("1.00 KB");
    }

    @Test
    void formatBytes_megabyteRounding() {
        assertThat(collector.formatBytes(1_572_864)).isEqualTo("1.50 MB"); // 1.5 * 1024^2
    }

    @Test
    void formatBytes_gigabyteRounding() {
        assertThat(collector.formatBytes(1_610_612_736L)).isEqualTo("1.50 GB"); // 1.5 * 1024^3
    }

    @Test
    void formatBytes_terabyteBoundary() {
        assertThat(collector.formatBytes(1_099_511_627_776L)).isEqualTo("1.00 TB"); // 1024^4
    }

    // ── JVM heap: every java* figure traces back to ONE reading ───────────────────

    /**
     * Nothing in the heap half of a {@link MemoryInfo} may contradict anything else in it.
     *
     * <p>This is the invariant the snapshot exists to guarantee. It used to hold only by luck:
     * the collectors read {@link Runtime} once per field, so a GC landing mid-build left
     * {@code javaUsedMemory} disagreeing with total-minus-free, and {@code javaUsedFormatted}
     * printing a different figure again.
     */
    private void assertHeapFieldsAgree(MemoryInfo mem) {
        assertThat(mem.getJavaUsedMemory()).isEqualTo(mem.getJavaTotalMemory() - mem.getJavaFreeMemory());
        assertThat(mem.getJavaTotalFormatted()).isEqualTo(collector.formatBytes(mem.getJavaTotalMemory()));
        assertThat(mem.getJavaFreeFormatted()).isEqualTo(collector.formatBytes(mem.getJavaFreeMemory()));
        assertThat(mem.getJavaMaxFormatted()).isEqualTo(collector.formatBytes(mem.getJavaMaxMemory()));
        assertThat(mem.getJavaUsedFormatted()).isEqualTo(collector.formatBytes(mem.getJavaUsedMemory()));
        assertThat(mem.getJavaMaxMemory()).isPositive();
    }

    @Test
    void basicMemoryInfo_javaFields_agreeWithEachOther() {
        assertHeapFieldsAgree(collector.getBasicMemoryInfo());
    }

    @Test
    void memoryInfo_javaFields_agreeWithEachOther() {
        assertHeapFieldsAgree(collector.getMemoryInfo());
    }

    @Test
    void addJavaMemoryInfo_fillsTheUsedFieldsToo() {
        // The shared helper is what the Windows collector calls, and it used to set six of the
        // eight fields -- leaving Windows reporting no javaUsedMemory at all.
        MemoryInfo mem = MemoryInfo.builder().build();
        collector.addJavaMemoryInfo(mem);

        assertThat(mem.getJavaUsedMemory()).isNotNull();
        assertThat(mem.getJavaUsedFormatted()).isNotNull();
        assertHeapFieldsAgree(mem);
    }

    @Test
    void heapOnlyCollectors_reportTheSameReadingOnBothHalvesOfTheObject() {
        // With no /proc or WMI to read, totalBytes IS javaTotalMemory. Taking a second reading
        // for the java* half would make one object quote two different heap sizes.
        for (MemoryInfo mem : List.of(heapOnly.getMemoryInfo(), heapOnly.getBasicMemoryInfo())) {
            assertHeapFieldsAgree(mem);
            assertThat(mem.getTotalBytes()).isEqualTo(mem.getJavaTotalMemory());
            assertThat(mem.getFreeBytes()).isEqualTo(mem.getJavaFreeMemory());
            assertThat(mem.getUsedBytes()).isEqualTo(mem.getJavaUsedMemory());
        }
    }

    @Test
    void memoryInfo_staysConsistent_whileAnotherThreadChurnsTheHeap() throws InterruptedException {
        // Asserting the invariant once only catches the old code when a GC happens to land in
        // the few microseconds an object takes to build, which is why it surfaced as a flake
        // roughly once per full suite run rather than as an honest failure. Allocating on THIS
        // thread does not help: the two reads happen back to back with nothing in between, so
        // they return the same number. The heap has to be moved by somebody else, which is what
        // the churn thread is for.
        AtomicBoolean stop = new AtomicBoolean();
        Thread churn = Thread.ofPlatform().daemon().name("heap-churn").start(() -> {
            List<byte[]> ballast = new ArrayList<>();
            while (!stop.get()) {
                ballast.add(new byte[256 * 1024]);
                if (ballast.size() > 128) ballast.clear();
            }
        });
        try {
            for (int i = 0; i < 1_000; i++) {
                assertHeapFieldsAgree(collector.getMemoryInfo());
                assertHeapFieldsAgree(heapOnly.getMemoryInfo());
            }
        } finally {
            stop.set(true);
            churn.join(2_000);
        }
    }
}
