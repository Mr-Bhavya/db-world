package com.db.dbworld.app.ipo.service;

import com.db.dbworld.app.ipo.dto.IpoDto;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Builds the stable dedup key ({@code matchKey}) that {@link IpoMergeService} groups by and
 * {@code IpoIngestService} looks IPOs up by, so that the same company reported slightly
 * differently by different sources (casing, legal suffix, stray whitespace) still collapses
 * onto one row.
 */
@Component
public class IpoNormalizer {

    /** Checked longest-most-specific first so e.g. "ltd." isn't shadowed by a looser match. */
    private static final List<String> LEGAL_SUFFIXES = List.of("limited", "private", "ltd.", "pvt.", "ltd", "pvt");

    private static final java.util.regex.Pattern NON_ALPHANUMERIC = java.util.regex.Pattern.compile("[^a-z0-9\\s]");
    private static final java.util.regex.Pattern WHITESPACE = java.util.regex.Pattern.compile("\\s+");

    /**
     * @return {@code normalize(companyName) + "|" + openDate}, or {@code null} if the dto has
     * no usable company name (uningestable — nothing to key on).
     */
    public String matchKey(IpoDto dto) {
        if (dto == null || dto.companyName() == null || dto.companyName().isBlank()) {
            return null;
        }
        String name = normalize(dto.companyName());
        if (name.isEmpty()) {
            return null;
        }
        String openDate = dto.openDate() == null ? "" : dto.openDate().toString();
        return name + "|" + openDate;
    }

    /** Returns a copy of {@code dto} with {@code matchKey} set (or cleared to {@code null}). */
    public IpoDto withMatchKey(IpoDto dto) {
        return new IpoDto(dto.source(), matchKey(dto), dto.companyName(), dto.ipoType(), dto.status(),
                dto.openDate(), dto.closeDate(), dto.allotmentDate(), dto.listingDate(),
                dto.priceMin(), dto.priceMax(), dto.lotSize(), dto.issueSize(),
                dto.listingExchange(), dto.listingPrice(), dto.listingGainPct(),
                dto.gmp(), dto.gmpPct(), dto.subQib(), dto.subNii(), dto.subRetail(), dto.subTotal(),
                dto.allotmentStatus(), dto.registrar(), dto.registrarUrl(), dto.logoUrl(), dto.about(),
                dto.refundDate(), dto.dematDate(), dto.faceValue(), dto.freshIssue(), dto.offerForSale(),
                dto.tickerSymbol(), dto.strengths(), dto.risks());
    }

    private String normalize(String companyName) {
        String s = companyName.toLowerCase().trim();
        // Repeatedly strip trailing legal-suffix tokens (a name can carry more than one, e.g.
        // "XYZ Private Limited") until none remain, so all legal-suffix variants of a company
        // collapse onto the same key.
        boolean strippedSomething = true;
        while (strippedSomething) {
            strippedSomething = false;
            for (String suffix : LEGAL_SUFFIXES) {
                if (s.endsWith(suffix)) {
                    s = s.substring(0, s.length() - suffix.length()).trim();
                    strippedSomething = true;
                    break;
                }
            }
        }
        s = NON_ALPHANUMERIC.matcher(s).replaceAll("");
        s = WHITESPACE.matcher(s.trim()).replaceAll(" ");
        return s.trim();
    }
}
