package com.db.dbworld.audit.tracking.aggregate;

import com.db.dbworld.audit.tracking.enums.ActivityKind;
import com.db.dbworld.audit.tracking.enums.ClientApp;
import java.time.Instant;
import java.util.List;

/** One shipper flush for a single session (request_id) built from nginx log lines. */
public record NginxTickAggregate(
        String sessionId,
        ActivityKind activity,
        List<long[]> deliveredRanges,   // inclusive [start,end]
        long transferredBytes,          // sum of body_bytes_sent this flush
        Long fileTotal,                 // from Content-Range, nullable
        int peakConnections,            // TransferMath.peakConcurrent over request windows
        Long maxSpeedBps,
        ClientApp clientApp,
        String realIp,
        String userAgent,
        Instant lastEventAt,
        boolean sawComplete
) {}
