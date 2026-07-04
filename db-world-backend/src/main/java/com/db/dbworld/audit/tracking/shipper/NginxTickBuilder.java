package com.db.dbworld.audit.tracking.shipper;

import com.db.dbworld.audit.tracking.aggregate.NginxTickAggregate;
import com.db.dbworld.audit.tracking.aggregate.TransferMath;
import com.db.dbworld.audit.tracking.enums.ActivityKind;
import com.db.dbworld.audit.tracking.enums.ClientApp;
import com.db.dbworld.audit.tracking.parse.CdnLogLine;
import com.db.dbworld.audit.tracking.parse.ClientAppDetector;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Pure logic: groups parsed {@link CdnLogLine}s by requestId (session) and folds each
 * group into a single {@link NginxTickAggregate} for one shipper flush ("tick").
 */
@Component
public class NginxTickBuilder {

    /** Builds one aggregate per distinct requestId, preserving first-seen order. */
    public List<NginxTickAggregate> build(List<CdnLogLine> lines) {
        Map<String, List<CdnLogLine>> byRequestId = new LinkedHashMap<>();
        for (CdnLogLine line : lines) {
            byRequestId.computeIfAbsent(line.requestId(), k -> new ArrayList<>()).add(line);
        }

        List<NginxTickAggregate> result = new ArrayList<>(byRequestId.size());
        for (Map.Entry<String, List<CdnLogLine>> entry : byRequestId.entrySet()) {
            result.add(buildOne(entry.getKey(), entry.getValue()));
        }
        return result;
    }

    private NginxTickAggregate buildOne(String sessionId, List<CdnLogLine> group) {
        List<long[]> deliveredRanges = new ArrayList<>();
        List<long[]> timeWindows = new ArrayList<>();

        long transferredBytes = 0L;
        Long fileTotal = null;
        Long maxSpeedBps = null;
        String realIp = null;
        String userAgent = null;
        Instant lastEventAt = null;
        boolean sawComplete = false;
        ActivityKind activity = group.get(0).activity();

        for (CdnLogLine line : group) {
            if (line.rangeStart() != null && line.rangeEnd() != null) {
                deliveredRanges.add(new long[] { line.rangeStart(), line.rangeEnd() });
            }

            transferredBytes += line.bytesSent();

            if (line.fileTotal() != null) {
                fileTotal = line.fileTotal();
            }

            long endMillis = line.time().toEpochMilli();
            long startMillis = endMillis - Math.round(line.durationSec() * 1000);
            timeWindows.add(new long[] { startMillis, endMillis });

            double effectiveDuration = line.durationSec() > 0 ? line.durationSec() : 0.001;
            long speedBps = Math.round(line.bytesSent() / effectiveDuration);
            if (maxSpeedBps == null || speedBps > maxSpeedBps) {
                maxSpeedBps = speedBps;
            }

            if (realIp == null && line.realIp() != null) {
                realIp = line.realIp();
            }
            if (userAgent == null && line.userAgent() != null) {
                userAgent = line.userAgent();
            }

            if (lastEventAt == null || line.time().isAfter(lastEventAt)) {
                lastEventAt = line.time();
            }

            if (line.isComplete()) {
                sawComplete = true;
            }
        }

        int peakConnections = TransferMath.peakConcurrent(timeWindows);
        ClientApp clientApp = ClientAppDetector.detect(userAgent);

        return new NginxTickAggregate(
                sessionId,
                activity,
                deliveredRanges,
                transferredBytes,
                fileTotal,
                peakConnections,
                maxSpeedBps,
                clientApp,
                realIp,
                userAgent,
                lastEventAt,
                sawComplete
        );
    }
}
