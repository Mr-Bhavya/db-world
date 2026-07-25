package com.db.dbworld.app.ipo.mapper;

import com.db.dbworld.app.ipo.dto.*;
import com.db.dbworld.app.ipo.entity.*;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.List;

@Component
public class IpoMapper {

    public IpoSummaryDto toSummary(IpoListingEntity e) {
        return new IpoSummaryDto(e.getId(), e.getCompanyName(), e.getIpoType(), e.getStatus(),
                e.getOpenDate(), e.getCloseDate(), e.getListingDate(), e.getPriceMin(), e.getPriceMax(),
                e.getGmp(), e.getGmpPct(), e.getSubTotal(), e.getLotSize(), e.getListingExchange(), e.getListingGainPct(),
                e.getAllotmentStatus(), e.getLogoUrl(), e.getRegistrarUrl());
    }

    public IpoDetailDto toDetail(IpoListingEntity e) {
        return new IpoDetailDto(e.getId(), e.getCompanyName(), e.getIpoType(), e.getStatus(),
                e.getOpenDate(), e.getCloseDate(), e.getAllotmentDate(), e.getListingDate(),
                e.getPriceMin(), e.getPriceMax(), e.getListingPrice(), e.getListingGainPct(),
                e.getGmp(), e.getGmpPct(), e.getSubTotal(), e.getLotSize(), e.getIssueSize(),
                e.getListingExchange(), e.getAllotmentStatus(), e.getRegistrar(), e.getRegistrarUrl(),
                e.getLogoUrl(), e.getAbout(), e.getRefundDate(), e.getDematDate(),
                e.getFaceValue(), e.getFreshIssue(), e.getOfferForSale(), e.getTickerSymbol(),
                splitLines(e.getStrengths()), splitLines(e.getRisks()));
    }

    /** Splits newline-delimited TEXT (as stored on the entity) into trimmed, non-blank lines; null/blank → empty list. */
    private static List<String> splitLines(String raw) {
        if (raw == null || raw.isBlank()) {
            return List.of();
        }
        return Arrays.stream(raw.split("\n"))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
    }

    public IpoFinancialDto toFinancial(IpoFinancialEntity e) {
        return new IpoFinancialDto(e.getFiscalYear(), e.getRevenue(), e.getPat());
    }

    public GmpPointDto toGmpPoint(IpoGmpHistoryEntity e) {
        return new GmpPointDto(e.getCapturedAt(), e.getGmp(), e.getGmpPct());
    }

    public SubscriptionPointDto toSubscriptionPoint(IpoSubscriptionHistoryEntity e) {
        return new SubscriptionPointDto(e.getCapturedAt(), e.getQib(), e.getNii(), e.getRetail(), e.getTotal());
    }

    public IpoChangeDto toChangeDto(IpoChangeEventEntity e) {
        return new IpoChangeDto(e.getIpoId(), e.getEventType(), e.getOldValue(), e.getNewValue(), e.getCreatedAt());
    }

    public SourceHealthDto toSourceHealth(IpoSourcePollEntity e) {
        return new SourceHealthDto(e.getSource(), e.getLastPolledAt(), e.getLastSuccessAt(),
                e.getLastStatus(), e.getConsecutiveFailures());
    }

    public IpoApplicationDto toApplicationDto(IpoUserApplicationEntity e) {
        return new IpoApplicationDto(e.getIpoId(), e.getApplicantName(), e.getApplicationNo(),
                e.getDpClientId(), e.getPanLast4(), e.getAllotmentResult());
    }

    /** Joins a saved application with a light summary of the IPO it's for, for the "My IPOs" list. */
    public MyIpoDto toMyIpoDto(IpoUserApplicationEntity application, IpoListingEntity ipo) {
        return new MyIpoDto(toApplicationDto(application), toSummary(ipo));
    }

    /**
     * Builds a brand-new entity from a merged dto. Does not set {@code id}, {@code firstSeenAt},
     * {@code lastSeenAt} or {@code updatedAt} — those are the ingest service's responsibility
     * (id is DB-generated; the timestamps depend on ingest's clock, not the mapper's).
     */
    public IpoListingEntity toNewEntity(IpoDto dto) {
        return IpoListingEntity.builder()
                .matchKey(dto.matchKey())
                .companyName(dto.companyName())
                .ipoType(dto.ipoType())
                .status(dto.status())
                .openDate(dto.openDate())
                .closeDate(dto.closeDate())
                .allotmentDate(dto.allotmentDate())
                .listingDate(dto.listingDate())
                .priceMin(dto.priceMin())
                .priceMax(dto.priceMax())
                .listingPrice(dto.listingPrice())
                .listingGainPct(dto.listingGainPct())
                .gmp(dto.gmp())
                .gmpPct(dto.gmpPct())
                .subTotal(dto.subTotal())
                .lotSize(dto.lotSize())
                .issueSize(dto.issueSize())
                .listingExchange(dto.listingExchange())
                .allotmentStatus(dto.allotmentStatus())
                .registrar(dto.registrar())
                .registrarUrl(dto.registrarUrl())
                .logoUrl(dto.logoUrl())
                .about(dto.about())
                .refundDate(dto.refundDate())
                .dematDate(dto.dematDate())
                .faceValue(dto.faceValue())
                .freshIssue(dto.freshIssue())
                .offerForSale(dto.offerForSale())
                .tickerSymbol(dto.tickerSymbol())
                .strengths(dto.strengths())
                .risks(dto.risks())
                .build();
    }

    /**
     * Copies every non-null field from {@code dto} onto {@code entity}, leaving fields the dto
     * didn't report (null) untouched — so a source that drops a field on one poll doesn't wipe
     * previously-good data. Never touches {@code id}, {@code matchKey}, or the seen/updated
     * timestamps; those are ingest's responsibility.
     */
    public void applyUpdatable(IpoDto dto, IpoListingEntity entity) {
        if (dto.companyName() != null) entity.setCompanyName(dto.companyName());
        if (dto.ipoType() != null) entity.setIpoType(dto.ipoType());
        if (dto.status() != null) entity.setStatus(dto.status());
        if (dto.openDate() != null) entity.setOpenDate(dto.openDate());
        if (dto.closeDate() != null) entity.setCloseDate(dto.closeDate());
        if (dto.allotmentDate() != null) entity.setAllotmentDate(dto.allotmentDate());
        if (dto.listingDate() != null) entity.setListingDate(dto.listingDate());
        if (dto.priceMin() != null) entity.setPriceMin(dto.priceMin());
        if (dto.priceMax() != null) entity.setPriceMax(dto.priceMax());
        if (dto.listingPrice() != null) entity.setListingPrice(dto.listingPrice());
        if (dto.listingGainPct() != null) entity.setListingGainPct(dto.listingGainPct());
        if (dto.gmp() != null) entity.setGmp(dto.gmp());
        if (dto.gmpPct() != null) entity.setGmpPct(dto.gmpPct());
        if (dto.subTotal() != null) entity.setSubTotal(dto.subTotal());
        if (dto.lotSize() != null) entity.setLotSize(dto.lotSize());
        if (dto.issueSize() != null) entity.setIssueSize(dto.issueSize());
        if (dto.listingExchange() != null) entity.setListingExchange(dto.listingExchange());
        if (dto.allotmentStatus() != null) entity.setAllotmentStatus(dto.allotmentStatus());
        if (dto.registrar() != null) entity.setRegistrar(dto.registrar());
        if (dto.registrarUrl() != null) entity.setRegistrarUrl(dto.registrarUrl());
        if (dto.logoUrl() != null) entity.setLogoUrl(dto.logoUrl());
        if (dto.about() != null) entity.setAbout(dto.about());
        if (dto.refundDate() != null) entity.setRefundDate(dto.refundDate());
        if (dto.dematDate() != null) entity.setDematDate(dto.dematDate());
        if (dto.faceValue() != null) entity.setFaceValue(dto.faceValue());
        if (dto.freshIssue() != null) entity.setFreshIssue(dto.freshIssue());
        if (dto.offerForSale() != null) entity.setOfferForSale(dto.offerForSale());
        if (dto.tickerSymbol() != null) entity.setTickerSymbol(dto.tickerSymbol());
        if (dto.strengths() != null) entity.setStrengths(dto.strengths());
        if (dto.risks() != null) entity.setRisks(dto.risks());
    }
}
