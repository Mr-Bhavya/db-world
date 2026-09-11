package com.db.dbworld.app.ipo.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/**
 * The duplicate-IPO report and its merge outcome — the review step in front of a merge.
 *
 * <p>A merge is not cosmetic: it repoints GMP history, subscription history, the audit trail and,
 * critically, {@code ipo_user_application} — real users' "My IPOs" entries. Name similarity does
 * produce false positives (a company's SME issue and its later mainboard issue have a byte-identical
 * name), so every field an operator needs to spot one is on the row: both names, both match keys,
 * both sets of dates, and how much real user data each side holds.
 */
public final class IpoDuplicateDto {

    private IpoDuplicateDto() {}

    /** One duplicate cluster: the row that would survive, and the rows that would be merged into it. */
    public record Cluster(String aliasKey, Row survivor, List<Row> losers) {

        /** Total rows in the cluster, survivor included — what an operator scans for "is this 2 or 5?". */
        public int size() {
            return 1 + losers.size();
        }

        /** Real user data at stake across the whole cluster, the single riskiest thing a merge moves. */
        public long userApplicationsAffected() {
            return losers.stream().mapToLong(Row::userApplications).sum();
        }
    }

    /** One IPO row in a cluster, with just enough context to judge whether the merge is right. */
    public record Row(String id,
                      String companyName,
                      String matchKey,
                      String status,
                      LocalDate openDate,
                      LocalDate closeDate,
                      LocalDate listingDate,
                      BigDecimal gmp,
                      Integer investorgainId,
                      long gmpHistoryPoints,
                      long userApplications,
                      Instant firstSeenAt) {}

    /** What a merge run actually did. Returned by the apply endpoint and logged. */
    public record MergeResult(int clustersMerged,
                              int rowsMerged,
                              int applicationsMoved,
                              int applicationsDroppedAsDuplicate,
                              List<String> notes) {}
}
