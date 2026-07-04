package com.db.dbworld.audit.tracking.shipper;

import com.db.dbworld.audit.tracking.aggregate.NginxTickAggregate;
import com.db.dbworld.audit.tracking.enums.ActivityKind;
import com.db.dbworld.audit.tracking.enums.ClientApp;
import com.db.dbworld.audit.tracking.parse.CdnLogLine;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class NginxTickBuilderTest {

    private final NginxTickBuilder builder = new NginxTickBuilder();

    @Test
    void build_groupsOverlappingRangesForOneDownloadSession() {
        Instant base = Instant.parse("2026-07-04T10:00:00Z");

        // Two parallel 206 range requests (aria2-style multi-connection download).
        // Windows: [base-2s, base] and [base-1.5s, base+0.5s] -> overlap -> peakConnections >= 2.
        CdnLogLine line1 = new CdnLogLine(
                "req-A", "dl-1", ActivityKind.DOWNLOAD,
                base, 206, 5000L,
                0L, 4999L, 10000L,
                "10.0.0.5", "aria2/1.36.0",
                2.0, 111L
        );
        CdnLogLine line2 = new CdnLogLine(
                "req-A", "dl-1", ActivityKind.DOWNLOAD,
                base.plusMillis(500), 206, 7500L,
                2500L, 9999L, 10000L,
                "10.0.0.5", "aria2/1.36.0",
                2.0, 112L
        );

        List<NginxTickAggregate> aggregates = builder.build(List.of(line1, line2));

        assertThat(aggregates).hasSize(1);
        NginxTickAggregate agg = aggregates.get(0);

        assertThat(agg.sessionId()).isEqualTo("req-A");
        assertThat(agg.activity()).isEqualTo(ActivityKind.DOWNLOAD);
        assertThat(agg.deliveredRanges()).hasSize(2);
        assertThat(agg.deliveredRanges()).extracting(r -> r[0]).containsExactlyInAnyOrder(0L, 2500L);
        assertThat(agg.deliveredRanges()).extracting(r -> r[1]).containsExactlyInAnyOrder(4999L, 9999L);
        assertThat(agg.transferredBytes()).isEqualTo(5000L + 7500L);
        assertThat(agg.fileTotal()).isEqualTo(10000L);
        assertThat(agg.peakConnections()).isGreaterThanOrEqualTo(2);
        assertThat(agg.clientApp()).isEqualTo(ClientApp.ARIA2);
        assertThat(agg.realIp()).isEqualTo("10.0.0.5");
        assertThat(agg.lastEventAt()).isEqualTo(base.plusMillis(500));
        // rangeEnd (9999) reaches fileTotal-1 (9999) on line2 -> complete.
        assertThat(agg.sawComplete()).isTrue();
    }

    @Test
    void build_singleStreamRequest_isCompleteWithOnePeakConnection() {
        Instant base = Instant.parse("2026-07-04T11:00:00Z");

        CdnLogLine line = new CdnLogLine(
                "req-B", "dl-2", ActivityKind.STREAM,
                base, 200, 20000L,
                null, null, null,
                "10.0.0.9", "Mozilla/5.0 Chrome/125.0",
                1.5, 200L
        );

        List<NginxTickAggregate> aggregates = builder.build(List.of(line));

        assertThat(aggregates).hasSize(1);
        NginxTickAggregate agg = aggregates.get(0);

        assertThat(agg.sessionId()).isEqualTo("req-B");
        assertThat(agg.activity()).isEqualTo(ActivityKind.STREAM);
        assertThat(agg.deliveredRanges()).isEmpty();
        assertThat(agg.transferredBytes()).isEqualTo(20000L);
        assertThat(agg.fileTotal()).isNull();
        assertThat(agg.peakConnections()).isEqualTo(1);
        assertThat(agg.clientApp()).isEqualTo(ClientApp.CHROME);
        assertThat(agg.sawComplete()).isTrue();
    }

    @Test
    void build_multipleRequestIds_producesSeparateAggregates() {
        Instant base = Instant.parse("2026-07-04T12:00:00Z");

        CdnLogLine a = new CdnLogLine(
                "req-A", "dl-1", ActivityKind.DOWNLOAD,
                base, 206, 5000L, 0L, 4999L, 10000L,
                "10.0.0.5", "aria2/1.36.0", 2.0, 111L
        );
        CdnLogLine b = new CdnLogLine(
                "req-B", "dl-2", ActivityKind.STREAM,
                base, 200, 20000L, null, null, null,
                "10.0.0.9", "Mozilla/5.0 Chrome/125.0", 1.5, 200L
        );

        List<NginxTickAggregate> aggregates = builder.build(List.of(a, b));

        assertThat(aggregates).hasSize(2);
        assertThat(aggregates).extracting(NginxTickAggregate::sessionId)
                .containsExactly("req-A", "req-B");
    }
}
