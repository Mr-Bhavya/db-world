package com.db.dbworld.infrastructure.logging;

import org.apache.logging.log4j.core.LoggerContext;
import org.apache.logging.log4j.core.appender.RollingFileAppender;
import org.apache.logging.log4j.core.appender.rolling.DefaultRolloverStrategy;
import org.apache.logging.log4j.core.appender.rolling.action.Action;
import org.apache.logging.log4j.core.appender.rolling.action.DeleteAction;
import org.apache.logging.log4j.core.config.ConfigurationSource;
import org.apache.logging.log4j.core.config.xml.XmlConfiguration;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.FileTime;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.TreeMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * Loads the production log4j2-spring.xml with log4j2's own parser and runs each RollingFile's
 * rollover Delete against real files. Production kept every archive back to February because the
 * Delete conditions were ANDed (age AND a 3GB size cap), and six of the eight appenders had no
 * Delete at all; a config that only looks right would pass a structural check, so this one deletes.
 */
class Log4j2ArchiveRetentionTest {

    private static final String LOG_DIR_LOOKUP = "${spring:app.paths.logs:-logs}";

    /** {@code ${spring:key:-default}}: Boot's spring: lookup throws without an Environment, so use the default. */
    private static final Pattern SPRING_LOOKUP = Pattern.compile("\\$\\{spring:[^}]*?:-([^}]*)}");

    @TempDir
    Path logDir;

    private XmlConfiguration config;

    @BeforeEach
    void loadProductionConfig() throws IOException {
        String xml;
        try (InputStream in = getClass().getClassLoader().getResourceAsStream("log4j2-spring.xml")) {
            xml = new String(Objects.requireNonNull(in, "log4j2-spring.xml is not on the classpath").readAllBytes(), UTF_8);
        }
        assertThat(xml).as("LOG_DIR lookup the test redirects into a temp dir").contains(LOG_DIR_LOOKUP);
        xml = xml.replace(LOG_DIR_LOOKUP, logDir.toString().replace('\\', '/'));
        xml = SPRING_LOOKUP.matcher(xml).replaceAll(m -> Matcher.quoteReplacement(m.group(1)));

        config = new XmlConfiguration(new LoggerContext("archive-retention-test"),
                new ConfigurationSource(new ByteArrayInputStream(xml.getBytes(UTF_8))));
        // Started, not just initialised: building the appenders already opens the live log files,
        // and only a started configuration closes them again on stop().
        config.start();
    }

    @AfterEach
    void stopConfig() {
        // Releases the live log files so the temp dir can be removed on Windows.
        if (config != null) config.stop();
    }

    @Test
    void everyRollingFile_deletesItsOwnStaleArchives_andNobodyElses() throws IOException {
        Map<String, RollingFileAppender> appenders = rollingFileAppenders();
        assertThat(appenders).as("RollingFile appenders in log4j2-spring.xml").isNotEmpty();

        for (var entry : appenders.entrySet()) {
            String owner = entry.getKey();
            List<Action> deletes = deleteActions(entry.getValue());
            assertThat(deletes).as("%s has a <Delete> in its DefaultRolloverStrategy", owner).isNotEmpty();

            // Every appender gets one archive well past RETENTION_DAYS and one from today, so the
            // run below shows both what the owner removes and what it must leave alone.
            LocalDate today = LocalDate.now();
            Map<String, Path> stale = new TreeMap<>();
            Map<String, Path> fresh = new TreeMap<>();
            for (var other : appenders.entrySet()) {
                stale.put(other.getKey(), archive(other.getValue(), today.minusDays(60), Duration.ofDays(60)));
                fresh.put(other.getKey(), archive(other.getValue(), today, Duration.ZERO));
            }

            for (Action delete : deletes) {
                delete.execute();
            }

            assertThat(stale.get(owner)).as("%s's 60-day-old archive", owner).doesNotExist();
            assertThat(fresh.get(owner)).as("%s's archive from today", owner).exists();
            stale.forEach((other, file) -> {
                if (!other.equals(owner)) {
                    assertThat(file).as("%s's archive after %s rolled over", other, owner).exists();
                }
            });

            for (Path file : stale.values()) Files.deleteIfExists(file);
            for (Path file : fresh.values()) Files.deleteIfExists(file);
        }
    }

    private Map<String, RollingFileAppender> rollingFileAppenders() {
        Map<String, RollingFileAppender> found = new TreeMap<>();
        config.getAppenders().forEach((name, appender) -> {
            if (appender instanceof RollingFileAppender rolling) found.put(name, rolling);
        });
        return found;
    }

    private static List<Action> deleteActions(RollingFileAppender appender) {
        if (!(appender.getManager().getRolloverStrategy() instanceof DefaultRolloverStrategy strategy)
                || strategy.getCustomActions() == null) {
            return List.of();
        }
        return strategy.getCustomActions().stream()
                .filter(DeleteAction.class::isInstance)
                .toList();
    }

    /** An archive file named exactly as the appender's filePattern would roll it, aged by {@code age}. */
    private static Path archive(RollingFileAppender appender, LocalDate date, Duration age) throws IOException {
        String name = appender.getFilePattern()
                .replace("%d{yyyy-MM-dd}", date.toString())
                .replace("%i", "1");
        assertThat(name).as("filePattern of %s uses only %%d{yyyy-MM-dd} and %%i", appender.getName())
                .doesNotContain("%");
        Path file = Path.of(name);
        Files.createDirectories(file.getParent());
        Files.writeString(file, "rotated log");
        Files.setLastModifiedTime(file, FileTime.from(Instant.now().minus(age)));
        return file;
    }
}
