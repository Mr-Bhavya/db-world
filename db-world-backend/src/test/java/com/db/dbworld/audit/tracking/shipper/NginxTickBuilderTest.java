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
                "req-A", ActivityKind.DOWNLOAD,
                base, 206, 5000L,
                0L, 4999L, 10000L,
                "10.0.0.5", "aria2/1.36.0",
                2.0, 111L
        );
        CdnLogLine line2 = new CdnLogLine(
                "req-A", ActivityKind.DOWNLOAD,
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
        // sawComplete is now always false from nginx; the aggregator derives completion
        // from real coverage instead of a line's requested range reaching the file tail.
        assertThat(agg.sawComplete()).isFalse();
    }

    @Test
    void build_truncatedTransfer_deliveredRangeReflectsActualBytesSent() {
        Instant base = Instant.parse("2026-07-04T10:30:00Z");

        // Client requested bytes 0-9999 (full file) but disconnected after 3000 bytes.
        CdnLogLine line = new CdnLogLine(
                "req-C", ActivityKind.DOWNLOAD,
                base, 206, 3000L,
                0L, 9999L, 10000L,
                "10.0.0.7", "aria2/1.36.0",
                1.0, 300L
        );

        List<NginxTickAggregate> aggregates = builder.build(List.of(line));

        assertThat(aggregates).hasSize(1);
        NginxTickAggregate agg = aggregates.get(0);

        assertThat(agg.deliveredRanges()).hasSize(1);
        long[] range = agg.deliveredRanges().get(0);
        assertThat(range[0]).isEqualTo(0L);
        // end == rangeStart + bytesSent - 1, NOT the requested rangeEnd (9999).
        assertThat(range[1]).isEqualTo(0L + 3000L - 1L);
        assertThat(agg.transferredBytes()).isEqualTo(3000L);
        assertThat(agg.sawComplete()).isFalse();
    }

    @Test
    void build_singleStreamRequest_isCompleteWithOnePeakConnection() {
        Instant base = Instant.parse("2026-07-04T11:00:00Z");

        CdnLogLine line = new CdnLogLine(
                "req-B", ActivityKind.STREAM,
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
        // No Content-Range on this line, but bytesSent > 0 still yields a delivered
        // interval anchored at 0 (start defaults to 0 when rangeStart is null).
        assertThat(agg.deliveredRanges()).hasSize(1);
        assertThat(agg.deliveredRanges().get(0)).containsExactly(0L, 19999L);
        assertThat(agg.transferredBytes()).isEqualTo(20000L);
        assertThat(agg.fileTotal()).isNull();
        assertThat(agg.peakConnections()).isEqualTo(1);
        assertThat(agg.clientApp()).isEqualTo(ClientApp.CHROME);
        // sawComplete is always false from nginx now; the aggregator decides completion.
        assertThat(agg.sawComplete()).isFalse();
    }

    @Test
    void build_multipleRequestIds_producesSeparateAggregates() {
        Instant base = Instant.parse("2026-07-04T12:00:00Z");

        CdnLogLine a = new CdnLogLine(
                "req-A", ActivityKind.DOWNLOAD,
                base, 206, 5000L, 0L, 4999L, 10000L,
                "10.0.0.5", "aria2/1.36.0", 2.0, 111L
        );
        CdnLogLine b = new CdnLogLine(
                "req-B", ActivityKind.STREAM,
                base, 200, 20000L, null, null, null,
                "10.0.0.9", "Mozilla/5.0 Chrome/125.0", 1.5, 200L
        );

        List<NginxTickAggregate> aggregates = builder.build(List.of(a, b));

        assertThat(aggregates).hasSize(2);
        assertThat(aggregates).extracting(NginxTickAggregate::sessionId)
                .containsExactly("req-A", "req-B");
    }
}
