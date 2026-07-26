package com.db.dbworld.app.ipo.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
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
         * a breakdown — {@code IpoGuruSource} populates this from its {@code subscription} object
         * (QIB/NII/Retail), while NSE and Chittorgarh currently leave it {@code null}
         * ({@code TODO(verify)} once those adapters are mapped against live responses).
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
        String risks,
        /**
         * Fiscal-year revenue/PAT/total-assets rows scraped from the detail page's "Company
         * Financials" section — {@code null}/empty for every source except {@code chittorgarh}
         * (the only adapter with a detail-page scrape; {@code TODO(verify)} once mapped against a
         * live response). Merged chittorgarh-first (it's the only source) by {@link
         * com.db.dbworld.app.ipo.service.IpoMergeService}; persisted by {@code IpoIngestService}
         * as an UPSERT into {@code IpoFinancialEntity}, separate from the listing entity itself.
         */
        List<IpoFinancialRowDto> financials,
        /**
         * Key-performance-indicator rows (ROE/ROCE/P/E/EPS/Market Cap/…) scraped from the detail
         * page — {@code null}/empty for every source except {@code chittorgarh}. Merged
         * chittorgarh-first; persisted as a JSON array on the listing entity ({@code kpis_json}).
         */
        List<IpoKpiDto> kpis,
        /**
         * "Objects of the Issue" rows (what the net proceeds fund + estimated amounts) scraped
         * from the detail page — {@code null}/empty except for {@code chittorgarh}. Merged
         * chittorgarh-first; persisted as a JSON array ({@code issue_objects_json}).
         */
        List<IpoIssueObjectDto> issueObjects
) {}
