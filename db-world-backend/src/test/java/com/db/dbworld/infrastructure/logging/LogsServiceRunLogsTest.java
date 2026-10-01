package com.db.dbworld.infrastructure.logging;

import com.db.dbworld.config.AppProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * The Scheduler page's run log. It used to fill its line budget from the info file before the
 * debug file was even opened, so a run with more INFO/WARN lines than the preview showed none
 * of its DEBUG lines, and nothing told you the list had been cut.
 */
class LogsServiceRunLogsTest {

    @TempDir Path logs;
    LogsService service;

    @BeforeEach
    void setUp() {
        AppProperties props = mock(AppProperties.class);
        when(props.getLogsPath()).thenReturn(logs);
        service = new LogsService(props);
    }

    private static String line(int second, String level, String runId, String message) {
        String ts = LocalDate.now() + "T09:00:%02d.000+0530".formatted(second);
        return "{\"timestamp\":\"" + ts + "\",\"level\":\"" + level + "\",\"thread\":\"job-scheduler-1\","
                + "\"logger\":\"com.db.dbworld.Job\",\"message\":\"" + message + "\","
                + "\"job\":\"Job\",\"jobRunId\":\"" + runId + "\"}";
    }

    private void write(String file, List<String> lines) throws Exception {
        Files.write(logs.resolve(file), lines);
    }

    /** Entries are AppInfoLogDto / AppDebugLogDto by level; both expose getMessage(). */
    private static List<String> messages(LogsService.RunLogs r) {
        return r.entries().stream().map(e -> {
            try {
                return (String) e.getClass().getMethod("getMessage").invoke(e);
            } catch (ReflectiveOperationException ex) {
                throw new AssertionError(ex);
            }
        }).toList();
    }

    @Test
    void debugLinesAreMergedInTimeOrderEvenWhenInfoAloneFillsTheCap() throws Exception {
        List<String> info = new ArrayList<>();
        for (int s = 0; s < 10; s += 2) info.add(line(s, "INFO", "run1", "info-" + s));
        info.add(line(30, "INFO", "other", "someone else's run"));
        write("db-world-info.json", info);
        write("db-world-debug.json", List.of(line(1, "DEBUG", "run1", "debug-1"), line(3, "DEBUG", "run1", "debug-3")));

        LogsService.RunLogs r = service.findRunLogs("run1", LocalDate.now(), 4);

        assertThat(messages(r)).containsExactly("info-0", "debug-1", "info-2", "debug-3");
        assertThat(r.total()).isEqualTo(7);
        assertThat(r.truncated()).isTrue();
    }

    @Test
    void aRunUnderTheCapComesBackWholeAndNotTruncated() throws Exception {
        write("db-world-info.json", List.of(line(0, "INFO", "run2", "start"), line(5, "WARN", "run2", "end")));
        write("db-world-debug.json", List.of(line(2, "DEBUG", "run2", "middle")));

        LogsService.RunLogs r = service.findRunLogs("run2", LocalDate.now(), 500);

        assertThat(messages(r)).containsExactly("start", "middle", "end");
        assertThat(r.total()).isEqualTo(3);
        assertThat(r.truncated()).isFalse();
    }
}
