package com.db.dbworld.app.ipo.service;

import com.db.dbworld.app.admin.config.registry.ConfigKeys;
import com.db.dbworld.app.admin.config.service.SettingsService;
import com.db.dbworld.app.ipo.notification.IpoMarketCalendar;
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
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
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
    private static final String STATUS_LISTED = "listed";
    private static final String SORT_GMP = "gmp";
    private static final String SORT_SUBSCRIPTION = "subscription";

    /** Indian IPO calendar zone — "listed long ago" is measured against today in IST. */
    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");

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
    private final SettingsService settings;
    private final IpoMarketCalendar marketCalendar;
    private final Clock clock;

    @Autowired
    public IpoQueryService(IpoListingRepository listingRepository,
                            IpoGmpHistoryRepository gmpHistoryRepository,
                            IpoSubscriptionHistoryRepository subscriptionHistoryRepository,
                            IpoFinancialRepository financialRepository,
                            IpoSourcePollService pollService,
                            IpoMapper mapper,
                            SettingsService settings,
                            IpoMarketCalendar marketCalendar) {
        this(listingRepository, gmpHistoryRepository, subscriptionHistoryRepository, financialRepository,
                pollService, mapper, settings, marketCalendar, Clock.systemUTC());
    }

    /** Test-friendly constructor with an injectable clock for a deterministic "today" (IST). */
    IpoQueryService(IpoListingRepository listingRepository,
                     IpoGmpHistoryRepository gmpHistoryRepository,
                     IpoSubscriptionHistoryRepository subscriptionHistoryRepository,
                     IpoFinancialRepository financialRepository,
                     IpoSourcePollService pollService,
                     IpoMapper mapper,
                     SettingsService settings,
                     IpoMarketCalendar marketCalendar,
                     Clock clock) {
        this.listingRepository = listingRepository;
        this.gmpHistoryRepository = gmpHistoryRepository;
        this.subscriptionHistoryRepository = subscriptionHistoryRepository;
        this.financialRepository = financialRepository;
        this.pollService = pollService;
        this.mapper = mapper;
        this.settings = settings;
        this.marketCalendar = marketCalendar;
        this.clock = clock;
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

        LocalDate staleListedCutoff = staleListedCutoff();
        List<IpoSummaryDto> ipos = entities.stream()
                .filter(e -> matchesType(e, type))
                .filter(e -> !isStaleListed(e, staleListedCutoff))
                .sorted(sortComparator(sort))
                .map(mapper::toSummary)
                .toList();
        return new IpoListResponse(ipos, pollService.lastSuccessAcrossSources().orElse(null));
    }

    /**
     * The cutoff before which an already-listed IPO counts as "listed long ago" and is dropped from
     * the list, keeping it current. {@code null} disables hiding ({@code ipo.list.hide-listed-after-days}
     * = 0). Measured against today in IST.
     */
    private LocalDate staleListedCutoff() {
        long hideAfterDays = settings.getLong(ConfigKeys.IPO_LIST_HIDE_LISTED_AFTER_DAYS);
        return hideAfterDays > 0 ? LocalDate.now(clock.withZone(IST)).minusDays(hideAfterDays) : null;
    }

    /**
     * Whether {@code entity} is a listed IPO old enough to hide — status "listed" with a known
     * listing date before {@code cutoff}. A null cutoff (feature off) or a listed IPO with no
     * listing date is never hidden.
     */
    private static boolean isStaleListed(IpoListingEntity entity, LocalDate cutoff) {
        return cutoff != null
                && STATUS_LISTED.equalsIgnoreCase(entity.getStatus())
                && entity.getListingDate() != null
                && entity.getListingDate().isBefore(cutoff);
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
     * Fills the timeline dates the sources don't report (allotment / refund / demat) for the detail
     * page's 6-stage timeline — no source supplies them (NSE nulls them; Chittorgarh's list JSON has
     * only open/close/listing), which is why they showed "TBA". Indian IPOs follow a fixed T+ schedule
     * off the close day, so a missing date is derived on the working-day calendar: allotment ≈ the next
     * working day after close (T+1), refund + demat ≈ the working day after allotment (T+2). A real
     * source value always wins when present. Needs a {@code closeDate} (or a real {@code allotmentDate})
     * to anchor on; otherwise left as-is. Never touches the stored entity — DTO-only.
     */
    private IpoDetailDto withDerivedTimelineDates(IpoDetailDto dto) {
        LocalDate allotment = dto.allotmentDate() != null
                ? dto.allotmentDate()
                : (dto.closeDate() != null ? nextWorkingDay(dto.closeDate().plusDays(1)) : null);
        if (allotment == null) {
            return dto; // no close/allotment date to anchor the schedule on
        }
        if (dto.allotmentDate() != null && dto.refundDate() != null && dto.dematDate() != null) {
            return dto; // everything already known from a source
        }
        LocalDate afterAllotment = nextWorkingDay(allotment.plusDays(1));
        LocalDate refundDate = dto.refundDate() != null ? dto.refundDate() : afterAllotment;
        LocalDate dematDate = dto.dematDate() != null ? dto.dematDate() : afterAllotment;
        return new IpoDetailDto(dto.id(), dto.companyName(), dto.ipoType(), dto.status(),
                dto.openDate(), dto.closeDate(), allotment, dto.listingDate(),
                dto.priceMin(), dto.priceMax(), dto.listingPrice(), dto.listingGainPct(),
                dto.gmp(), dto.gmpPct(), dto.subTotal(), dto.lotSize(), dto.issueSize(),
                dto.listingExchange(), dto.allotmentStatus(), dto.registrar(), dto.registrarUrl(),
                dto.logoUrl(), dto.logoDomain(), dto.about(), refundDate, dematDate,
                dto.faceValue(), dto.freshIssue(), dto.offerForSale(), dto.tickerSymbol(),
                dto.strengths(), dto.risks(),
                dto.foundedYear(), dto.managingDirector(), dto.parentCompany(),
                dto.sector(), dto.headquarters(), dto.website(),
                dto.kpis(), dto.issueObjects(), dto.leadManagers(), dto.issueDetails());
    }

    /** The given date, rolled forward to the next trading day — skips weekends AND configured NSE holidays. */
    private LocalDate nextWorkingDay(LocalDate date) {
        LocalDate d = date;
        while (!marketCalendar.isTradingDay(d)) {
            d = d.plusDays(1);
        }
        return d;
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
