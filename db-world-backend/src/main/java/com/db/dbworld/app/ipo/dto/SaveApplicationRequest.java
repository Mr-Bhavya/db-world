package com.db.dbworld.app.ipo.dto;

/**
 * Body for saving/updating a "My IPOs" application. {@code pan} may be a FULL pan typed by the
 * user — it is transient: {@code IpoApplicationService} extracts the last 4 characters and
 * discards the rest immediately; the full value is never persisted or logged. Omit {@code pan}
 * (null/blank) to leave a previously-saved {@code panLast4} untouched.
 */
public record SaveApplicationRequest(
        String applicantName,
        String applicationNo,
        String dpClientId,
        String pan,
        String allotmentResult
) {}
