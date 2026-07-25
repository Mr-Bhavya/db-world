package com.db.dbworld.app.ipo.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

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
        String about,
        LocalDate refundDate,
        LocalDate dematDate
) {}
