package com.db.dbworld.app.ipo.dto;

/**
 * Miscellaneous "Issue details" for the detail page, scraped from the NSE {@code /api/ipo-detail}
 * {@code issueInfo.dataList} — the issue mechanism, the minimum order quantity, the sponsor bank,
 * and the Red-Herring / Draft-Red-Herring prospectus document links. Every field is independently
 * optional (a given issue may report some and not others), and the whole object is {@code null}
 * for any IPO NSE didn't enrich. Persisted as a single JSON object on the listing entity
 * ({@code issue_details_json}); parallels the KPI / Objects-of-the-Issue JSON columns.
 *
 * @param issueType        e.g. {@code "100% Book Building"} / {@code "Fixed Price Issue"}
 * @param minOrderQuantity e.g. {@code "Minimum 110 Equity Shares"}
 * @param sponsorBank      e.g. {@code "Axis Bank Limited"}
 * @param rhpUrl           Red Herring Prospectus document URL (once filed)
 * @param drhpUrl          Draft Red Herring Prospectus document URL (pre-RHP)
 */
public record IpoIssueDetailsDto(
        String issueType,
        String minOrderQuantity,
        String sponsorBank,
        String rhpUrl,
        String drhpUrl
) {
    /** True when every field is null/blank — used by producers to collapse an all-empty scrape to {@code null}. */
    public boolean isEmpty() {
        return isBlank(issueType) && isBlank(minOrderQuantity) && isBlank(sponsorBank)
                && isBlank(rhpUrl) && isBlank(drhpUrl);
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
