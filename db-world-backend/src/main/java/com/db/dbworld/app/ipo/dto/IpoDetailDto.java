package com.db.dbworld.app.ipo.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/** Full merged view of one IPO, for the detail page. */
public record IpoDetailDto(
        String id,
        String companyName,
        String ipoType,
        String status,
        LocalDate openDate,
        LocalDate closeDate,
        LocalDate allotmentDate,
        LocalDate listingDate,
        BigDecimal priceMin,
        BigDecimal priceMax,
        BigDecimal listingPrice,
        BigDecimal listingGainPct,
        BigDecimal gmp,
        BigDecimal gmpPct,
        BigDecimal subTotal,
        Integer lotSize,
        String issueSize,
        String listingExchange,
        String allotmentStatus,
        String registrar,
        String registrarUrl,
        String logoUrl,
        String logoDomain,
        String about,
        LocalDate refundDate,
        LocalDate dematDate,
        BigDecimal faceValue,
        BigDecimal freshIssue,
        BigDecimal offerForSale,
        String tickerSymbol,
        List<String> strengths,
        List<String> risks,
        Integer foundedYear,
        String managingDirector,
        String parentCompany,
        String sector,
        String headquarters,
        String website,
        List<IpoKpiDto> kpis,
        List<IpoIssueObjectDto> issueObjects,
        List<String> leadManagers,
        IpoIssueDetailsDto issueDetails,

        // ── Investorgain live tier ──────────────────────────────────────────────────────────
        // All reported, none computed: investorgain publishes the percentages, the estimated
        // listing price and the profit estimate itself. The three grey-market figures
        // (estimatedListingPrice / subjectToSauda / estProfit) are unofficial by nature, so the
        // UI renders them attributed to investorgain rather than as our own numbers.
        Integer gmpRating,
        BigDecimal gmpMin,
        BigDecimal gmpMax,
        String gmpUpdatedLabel,
        BigDecimal estimatedListingPrice,
        BigDecimal subjectToSauda,
        BigDecimal estProfit,
        BigDecimal peRatio,
        Boolean anchorInvestor,
        String allotmentLink,
        String subscriptionUpdatedLabel
) {}
