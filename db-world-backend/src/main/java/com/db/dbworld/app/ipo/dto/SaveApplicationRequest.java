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
) {
    /**
     * Redacts {@code pan} so a stray {@code log.debug(..., req)} (this package logs at DEBUG)
     * can never write a full PAN to disk. All other fields are printed as-is.
     */
    @Override
    public String toString() {
        return "SaveApplicationRequest[applicantName=" + applicantName
                + ", applicationNo=" + applicationNo
                + ", dpClientId=" + dpClientId
                + ", pan=***"
                + ", allotmentResult=" + allotmentResult
                + ']';
    }
}
