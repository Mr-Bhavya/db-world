package com.db.dbworld.audit.tracking.parse;

import com.db.dbworld.audit.tracking.enums.ActivityKind;
import java.time.Instant;

/** Typed view of one nginx cdn_json access-log line (media requests only). */
public record CdnLogLine(
        String requestId,
        String downloadId,
        ActivityKind activity,   // DOWNLOAD (type=DOWNLOAD) | STREAM (type=ONLINE)
        Instant time,
        int status,
        long bytesSent,
        Long rangeStart,         // inclusive; null if no Content-Range
        Long rangeEnd,           // inclusive; null if no Content-Range
        Long fileTotal,          // from Content-Range "…/total"; null if unknown
        String realIp,
        String userAgent,
        double durationSec,
        Long connId              // nginx $connection; null if absent
) {
    /** True when this request delivered the final byte of the file. */
    public boolean isComplete() {
        if (status == 200) return true;
        return status == 206 && rangeEnd != null && fileTotal != null && rangeEnd >= fileTotal - 1;
    }
}
