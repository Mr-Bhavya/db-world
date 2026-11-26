package com.db.dbworld.app.media.ingestion.tracking.log;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class HtmlReportBuilderTest {

    @Test
    void build_createsStructuredReportAndEscapesLogContent() {
        LogCollector collector = new LogCollector();
        collector.info("download", "<img src=x onerror=alert(1)>");
        collector.error("import", "Failed & stopped");

        String html = new HtmlReportBuilder().build(collector);

        assertThat(html)
                .contains("2 events · 1 error")
                .contains("class='log-entry error'")
                .contains("&lt;img src=x onerror=alert(1)&gt;")
                .contains("Failed &amp; stopped")
                .doesNotContain("<img src=x");
    }

    @Test
    void build_emptyCollectorShowsExplicitEmptyState() {
        assertThat(new HtmlReportBuilder().build(new LogCollector()))
                .contains("No log events were recorded for this job.");
    }
}
