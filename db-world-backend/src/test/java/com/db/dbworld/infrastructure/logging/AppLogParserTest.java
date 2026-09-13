package com.db.dbworld.infrastructure.logging;

import com.db.dbworld.infrastructure.logging.dto.AppLogEnvelopeDto;
import com.db.dbworld.infrastructure.logging.dto.LogType;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class AppLogParserTest {

    private final AppLogParser parser = new AppLogParser();

    private static String line(String level, String extra) {
        return "{\"timestamp\":\"2026-09-13T21:17:07.898+0530\",\"level\":\"" + level + "\","
                + "\"thread\":\"manual-trigger-TagScheduler\","
                + "\"logger\":\"com.db.dbworld.app.cinema.catalog.tags.strategy.TagStrategyExecutor\","
                + "\"message\":\"Tag strategy skipped\"" + extra + "}";
    }

    /**
     * The info log is written with a ThresholdFilter at INFO, so it is full of WARN lines.
     * WARN was commented out of {@link LogType} and {@code from} threw, so every one of them
     * failed to parse — and the parser logs that failure at WARN into the same file, so each
     * read appended a fresh unparseable line.
     */
    @Test
    void parsesWarnLines_ratherThanFallingBackToRaw() {
        AppLogEnvelopeDto env = parser.parse(line("WARN", ""));

        assertThat(env.getRawLine()).isNull();
        assertThat(env.getInfo()).isNotNull();
        assertThat(env.getInfo().getLevel()).isEqualTo(LogType.WARN);
        assertThat(env.getInfo().getMessage()).isEqualTo("Tag strategy skipped");
    }

    /** An unrecognised level must not be able to restart that loop. */
    @Test
    void unknownLevel_degradesToUnknown_insteadOfThrowing() {
        assertThat(LogType.from("FATAL")).isEqualTo(LogType.UNKNOWN);
        assertThat(LogType.from("warn")).isEqualTo(LogType.WARN);
        assertThat(LogType.from(null)).isNull();

        AppLogEnvelopeDto env = parser.parse(line("FATAL", ""));
        assertThat(env.getRawLine()).isNull();
        assertThat(env.getInfo()).isNotNull();
    }

    @Test
    void keepsSchedulerRunCorrelationFields() {
        AppLogEnvelopeDto env = parser.parse(
                line("INFO", ",\"job\":\"TagScheduler\",\"jobRunId\":\"a1b2c3d4e5f6\""));

        assertThat(env.getInfo().getJob()).isEqualTo("TagScheduler");
        assertThat(env.getInfo().getJobRunId()).isEqualTo("a1b2c3d4e5f6");
    }

    @Test
    void errorLinesStillRouteToTheErrorShape() {
        AppLogEnvelopeDto env = parser.parse(line("ERROR", ",\"stacktrace\":\"boom\""));

        assertThat(env.getType()).isEqualTo(LogType.ERROR);
        assertThat(env.getError().getStacktrace()).isEqualTo("boom");
    }

    @Test
    void malformedJson_fallsBackToTheRawLine() {
        AppLogEnvelopeDto env = parser.parse("not json at all");

        assertThat(env.getType()).isEqualTo(LogType.UNKNOWN);
        assertThat(env.getRawLine()).isEqualTo("not json at all");
    }
}
