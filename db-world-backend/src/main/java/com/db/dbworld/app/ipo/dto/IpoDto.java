package com.db.dbworld.app.ipo.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;

/**
 * A single source's normalised view of one IPO. Every field is nullable-friendly —
 * a given source may not report all of them.
 */
public record IpoDto(
        String source,
        String matchKey,
        String companyName,
        String ipoType,
        String status,
        LocalDate openDate,
        LocalDate closeDate,
        LocalDate allotmentDate,
        LocalDate listingDate,
        BigDecimal priceMin,
        BigDecimal priceMax,
        Integer lotSize,
        String issueSize,
        String listingExchange,
        BigDecimal listingPrice,
        BigDecimal listingGainPct,
        BigDecimal gmp,
        BigDecimal gmpPct,
        /**
         * Category → multiple map (e.g. {@code {"QIB":2.10,"NII":5.30,"Retail":8.00}}) —
         * insertion order matters (source ordering, preserved via LinkedHashMap by producers) and
         * is carried through to {@code categoriesJson}. {@code null} when a source hasn't reported
         * a breakdown (adapters currently set this to {@code null}; see the TODO in each adapter).
         */
        Map<String, BigDecimal> subscriptionCategories,
        BigDecimal subTotal,
        String allotmentStatus,
        String registrar,
        String registrarUrl,
        String logoUrl,
        String about,
        LocalDate refundDate,
        LocalDate dematDate,
        BigDecimal faceValue,
        BigDecimal freshIssue,
        BigDecimal offerForSale,
        String tickerSymbol,
        String strengths,
        String risks
) {}
