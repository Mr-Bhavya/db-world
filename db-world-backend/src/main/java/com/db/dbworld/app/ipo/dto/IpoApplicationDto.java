package com.db.dbworld.app.ipo.dto;

/** A user's saved application details for one IPO. {@code panLast4} is the only PAN-derived field — never the full value. */
public record IpoApplicationDto(
        String ipoId,
        String applicantName,
        String applicationNo,
        String dpClientId,
        String panLast4,
        String allotmentResult
) {}
