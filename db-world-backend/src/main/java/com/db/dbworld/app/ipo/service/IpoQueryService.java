package com.db.dbworld.app.ipo.service;

import com.db.dbworld.app.ipo.dto.GmpPointDto;
import com.db.dbworld.app.ipo.dto.IpoDetailDto;
import com.db.dbworld.app.ipo.dto.IpoFinancialDto;
import com.db.dbworld.app.ipo.dto.IpoListResponse;
import com.db.dbworld.app.ipo.dto.IpoSummaryDto;
import com.db.dbworld.app.ipo.dto.SubscriptionPointDto;
import com.db.dbworld.app.ipo.entity.IpoListingEntity;
import com.db.dbworld.app.ipo.mapper.IpoMapper;
import com.db.dbworld.app.ipo.repository.IpoFinancialRepository;
import com.db.dbworld.app.ipo.repository.IpoGmpHistoryRepository;
import com.db.dbworld.app.ipo.repository.IpoListingRepository;
import com.db.dbworld.app.ipo.repository.IpoSubscriptionHistoryRepository;
import com.db.dbworld.core.exception.DbWorldException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;

/**
 * Read-only queries behind the IPO tracker's user-facing endpoints: the list view (each row plus
 * a "last updated" stamp sourced from {@link IpoSourcePollService}), the detail page, the
 * financials (P&amp;L) series, and the GMP / subscription history series that feed the
 * frontend's charts.
 */
@Service
public class IpoQueryService {

    private static final String TYPE_ALL = "all";
    private static final String SORT_GMP = "gmp";
    private static final String SORT_SUBSCRIPTION = "subscription";

    /** Newest open date first; IPOs with no open date yet (not announced) sort to the end. */
    private static final Comparator<IpoListingEntity> SORT_DATE =
            Comparator.comparing(IpoListingEntity::getOpenDate, Comparator.nullsLast(Comparator.reverseOrder()));

    /** Highest GMP% first; IPOs with no GMP reading yet sort to the end. */
    private static final Comparator<IpoListingEntity> SORT_GMP_DESC =
            Comparator.comparing(IpoListingEntity::getGmpPct, Comparator.nullsLast(Comparator.reverseOrder()));

    /** Highest subscription total first; IPOs with no subscription reading yet sort to the end. */
    private static final Comparator<IpoListingEntity> SORT_SUBSCRIPTION_DESC =
            Comparator.comparing(IpoListingEntity::getSubTotal, Comparator.nullsLast(Comparator.reverseOrder()));

    private final IpoListingRepository listingRepository;
    private final IpoGmpHistoryRepository gmpHistoryRepository;
    private final IpoSubscriptionHistoryRepository subscriptionHistoryRepository;
    private final IpoFinancialRepository financialRepository;
    private final IpoSourcePollService pollService;
    private final IpoMapper mapper;

    public IpoQueryService(IpoListingRepository listingRepository,
                            IpoGmpHistoryRepository gmpHistoryRepository,
                            IpoSubscriptionHistoryRepository subscriptionHistoryRepository,
                            IpoFinancialRepository financialRepository,
                            IpoSourcePollService pollService,
                            IpoMapper mapper) {
        this.listingRepository = listingRepository;
        this.gmpHistoryRepository = gmpHistoryRepository;
        this.subscriptionHistoryRepository = subscriptionHistoryRepository;
        this.financialRepository = financialRepository;
        this.pollService = pollService;
        this.mapper = mapper;
    }

    /**
     * All IPOs, optionally filtered by {@code status} (canonicalized so any of a source's raw
     * wordings still matches) and {@code type} ({@code mainboard}|{@code sme}; blank/{@code all}
     * = no filter), sorted per {@code sort} ({@code date} default, {@code gmp}, or
     * {@code subscription} — each descending, nulls last).
     */
    public IpoListResponse list(String status, String type, String sort) {
        String canonicalStatus = IpoStatusCanonicalizer.canonical(status);
        List<IpoListingEntity> entities = canonicalStatus != null
                ? listingRepository.findByStatus(canonicalStatus)
                : listingRepository.findAll();

        List<IpoSummaryDto> ipos = entities.stream()
                .filter(e -> matchesType(e, type))
                .sorted(sortComparator(sort))
                .map(mapper::toSummary)
                .toList();
        return new IpoListResponse(ipos, pollService.lastSuccessAcrossSources().orElse(null));
    }

    public IpoDetailDto detail(String id) {
        IpoListingEntity entity = listingRepository.findById(id)
                .orElseThrow(() -> new DbWorldException(HttpStatus.NOT_FOUND, "IPO not found"));
        return withDerivedTimelineDates(mapper.toDetail(entity));
    }

    /**
     * Fiscal-year revenue/PAT/total-assets series for the detail page's P&amp;L section, in
     * chronological order (sorted by {@code periodEnd}, not the {@code fiscalYear} display label —
     * that label isn't sortable as a string, e.g. "Feb 2026" would otherwise sort before
     * "FY 2021-22"). Empty (not 404) if none captured.
     */
    public List<IpoFinancialDto> financials(String id) {
        return financialRepository.findByIpoIdOrderByPeriodEndAsc(id).stream()
                .map(mapper::toFinancial)
                .toList();
    }

    /** Chronological GMP series for the chart; empty (not 404) if the IPO has no history yet. */
    public List<GmpPointDto> gmpHistory(String id) {
        return gmpHistoryRepository.findByIpoIdOrderByCapturedAtAsc(id).stream()
                .map(mapper::toGmpPoint)
                .toList();
    }

    /** Chronological subscription series for the chart; empty (not 404) if none captured yet. */
    public List<SubscriptionPointDto> subscriptionHistory(String id) {
        return subscriptionHistoryRepository.findByIpoIdOrderByCapturedAtAsc(id).stream()
                .map(mapper::toSubscriptionPoint)
                .toList();
    }

    /**
     * Fills {@code refundDate}/{@code dematDate} on the DTO returned for the detail page's 6-stage
     * timeline when the source hasn't reported them yet: both conventionally land the day after
     * allotment finalizes, so each null one is derived as {@code allotmentDate.plusDays(1)}.
     * Leaves both null if {@code allotmentDate} itself isn't known yet. Never touches the stored
     * entity — this only affects the DTO built for this read.
     */
    private static IpoDetailDto withDerivedTimelineDates(IpoDetailDto dto) {
        if (dto.allotmentDate() == null) {
            return dto;
        }
        if (dto.refundDate() != null && dto.dematDate() != null) {
            return dto;
        }
        LocalDate derived = dto.allotmentDate().plusDays(1);
        LocalDate refundDate = dto.refundDate() != null ? dto.refundDate() : derived;
        LocalDate dematDate = dto.dematDate() != null ? dto.dematDate() : derived;
        return new IpoDetailDto(dto.id(), dto.companyName(), dto.ipoType(), dto.status(),
                dto.openDate(), dto.closeDate(), dto.allotmentDate(), dto.listingDate(),
                dto.priceMin(), dto.priceMax(), dto.listingPrice(), dto.listingGainPct(),
                dto.gmp(), dto.gmpPct(), dto.subTotal(), dto.lotSize(), dto.issueSize(),
                dto.listingExchange(), dto.allotmentStatus(), dto.registrar(), dto.registrarUrl(),
                dto.logoUrl(), dto.logoDomain(), dto.about(), refundDate, dematDate,
                dto.faceValue(), dto.freshIssue(), dto.offerForSale(), dto.tickerSymbol(),
                dto.strengths(), dto.risks(),
                dto.foundedYear(), dto.managingDirector(), dto.parentCompany(),
                dto.sector(), dto.headquarters(), dto.website(),
                dto.kpis(), dto.issueObjects(), dto.leadManagers());
    }

    /** Blank or {@code all} means no type filter; otherwise a case-insensitive exact match on {@code ipoType}. */
    private static boolean matchesType(IpoListingEntity entity, String type) {
        if (!StringUtils.hasText(type) || TYPE_ALL.equalsIgnoreCase(type.trim())) {
            return true;
        }
        return type.trim().equalsIgnoreCase(entity.getIpoType());
    }

    private static Comparator<IpoListingEntity> sortComparator(String sort) {
        if (SORT_GMP.equalsIgnoreCase(sort)) {
            return SORT_GMP_DESC;
        }
        if (SORT_SUBSCRIPTION.equalsIgnoreCase(sort)) {
            return SORT_SUBSCRIPTION_DESC;
        }
        return SORT_DATE;
    }
}
