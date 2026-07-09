package com.db.dbworld.app.system.info.collector;

import com.db.dbworld.app.system.info.collector.linux.LinuxServerInfoCollector;
import com.db.dbworld.app.system.info.dto.MemoryInfo;
import com.db.dbworld.core.processor.ProcessExecutor;
import org.junit.jupiter.api.Test;

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

    // ── JVM heap math: used = total - free, reported consistently ──────────────────

    @Test
    void basicMemoryInfo_javaUsedMemory_equalsTotalMinusFree() {
        MemoryInfo mem = collector.getBasicMemoryInfo();

        assertThat(mem.getJavaUsedMemory()).isEqualTo(mem.getJavaTotalMemory() - mem.getJavaFreeMemory());
        assertThat(mem.getJavaUsedFormatted()).isEqualTo(collector.formatBytes(mem.getJavaUsedMemory()));
        assertThat(mem.getJavaMaxMemory()).isPositive();
    }

    @Test
    void memoryInfo_javaUsedMemory_equalsTotalMinusFree() {
        MemoryInfo mem = collector.getMemoryInfo();

        assertThat(mem.getJavaUsedMemory()).isEqualTo(mem.getJavaTotalMemory() - mem.getJavaFreeMemory());
        assertThat(mem.getJavaUsedFormatted()).isEqualTo(collector.formatBytes(mem.getJavaUsedMemory()));
        assertThat(mem.getJavaMaxMemory()).isPositive();
    }
}
