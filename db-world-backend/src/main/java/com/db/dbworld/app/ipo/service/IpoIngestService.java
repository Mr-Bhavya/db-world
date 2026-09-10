package com.db.dbworld.app.ipo.service;

import com.db.dbworld.app.ipo.dto.IpoDto;
import com.db.dbworld.app.ipo.dto.IpoFinancialRowDto;
import com.db.dbworld.app.ipo.entity.IpoChangeEventEntity;
import com.db.dbworld.app.ipo.entity.IpoFinancialEntity;
import com.db.dbworld.app.ipo.entity.IpoGmpHistoryEntity;
import com.db.dbworld.app.ipo.entity.IpoListingEntity;
import com.db.dbworld.app.ipo.mapper.IpoMapper;
import com.db.dbworld.app.ipo.repository.IpoChangeEventRepository;
import com.db.dbworld.app.ipo.repository.IpoFinancialRepository;
import com.db.dbworld.app.ipo.repository.IpoGmpHistoryRepository;
import com.db.dbworld.app.ipo.repository.IpoListingRepository;
import com.db.dbworld.app.ipo.repository.IpoSubscriptionHistoryRepository;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Persists the merged per-IPO feed produced by {@link IpoMergeService}: creates new listings,
 * applies field updates to existing ones, and appends a change-event / GMP / subscription trail.
 *
 * <p>Everything here is append-on-change and therefore idempotent: re-ingesting a feed that is
 * identical to what's already stored emits no events and inserts no history rows (only
 * {@code lastSeenAt} advances).
 */
@Log4j2
@Service
public class IpoIngestService {

    private static final String STATUS_UPCOMING = "upcoming";
    private static final String STATUS_OPEN = "open";
    private static final String STATUS_CLOSED = "closed";
    private static final String STATUS_LISTED = "listed";

    /** Indian IPO calendar zone — status boundaries (open/close/listing) flip at IST midnight. */
    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");

    /**
     * How far two open dates may drift and still be read as the SAME issue by the alias fallback.
     * Wide enough for a real-world schedule revision (issuers routinely push an issue by a few
     * days, and the feeds pick that up at different times), narrow enough that a company's SME
     * issue and its later mainboard issue — identical name, months apart — stay two rows.
     */
    private static final int ALIAS_DATE_TOLERANCE_DAYS = 21;

    private final IpoListingRepository listingRepo;
    private final IpoGmpHistoryRepository gmpHistoryRepo;
    private final IpoSubscriptionHistoryRepository subHistoryRepo;
    private final IpoChangeEventRepository changeEventRepo;
    private final IpoFinancialRepository financialRepo;
    private final IpoMapper mapper;
    private final IpoNormalizer normalizer;
    private final Clock clock;

    @Autowired
    public IpoIngestService(IpoListingRepository listingRepo, IpoGmpHistoryRepository gmpHistoryRepo,
                             IpoSubscriptionHistoryRepository subHistoryRepo, IpoChangeEventRepository changeEventRepo,
                             IpoFinancialRepository financialRepo, IpoMapper mapper, IpoNormalizer normalizer) {
        this(listingRepo, gmpHistoryRepo, subHistoryRepo, changeEventRepo, financialRepo, mapper, normalizer,
                Clock.systemUTC());
    }

    /** Test-friendly constructor with an injectable clock for deterministic {@code now()}. */
    IpoIngestService(IpoListingRepository listingRepo, IpoGmpHistoryRepository gmpHistoryRepo,
                      IpoSubscriptionHistoryRepository subHistoryRepo, IpoChangeEventRepository changeEventRepo,
                      IpoFinancialRepository financialRepo, IpoMapper mapper, IpoNormalizer normalizer, Clock clock) {
        this.listingRepo = listingRepo;
        this.gmpHistoryRepo = gmpHistoryRepo;
        this.subHistoryRepo = subHistoryRepo;
        this.changeEventRepo = changeEventRepo;
        this.financialRepo = financialRepo;
        this.mapper = mapper;
        this.normalizer = normalizer;
        this.clock = clock;
    }

    /**
     * Ingests the merged feed, persisting each detected change as an {@code ipo_change_event} row.
     *
     * <p>Nothing is returned and nothing is pushed from here: the change events themselves ARE the
     * notification queue, which {@code IpoNotificationService.dispatchPending()} drains separately.
     * That's deliberate — a push that couldn't be sent at ingest time (outside the IST notification
     * window) used to be lost forever, because this method commits the new status and no later poll
     * re-detects the transition. Persist-then-drain means delivery can be retried and can run on
     * its own schedule.
     */
    @Transactional
    public void ingest(List<IpoDto> merged) {
        for (IpoDto dto : merged) {
            ingestOne(dto);
        }
    }

    private void ingestOne(IpoDto rawDto) {
        // Canonicalize status and ipoType once, up front, so every downstream read of
        // dto.status()/dto.ipoType() — the change-detection compare below, mapper.toNewEntity,
        // and mapper.applyUpdatable — sees (and stores) the same canonical lowercase value
        // regardless of a source's own wording (e.g. NSE's "Active"/"Listed", or
        // "Main Board"/"NSE Emerge" for type). This is what makes the "listed" LISTING-transition
        // check and the status/type filters reliable across sources.
        IpoDto dto = withDerivedListingGain(withCalendarStatus(
                withDerivedStatus(withCanonicalType(withCanonicalStatus(rawDto)))));
        Instant now = clock.instant();
        String aliasKey = normalizer.aliasKey(dto.companyName());
        IpoListingEntity existing = listingRepo.findByMatchKey(dto.matchKey())
                .orElseGet(() -> resolveByAlias(aliasKey, dto));

        if (existing == null) {
            IpoListingEntity entity = mapper.toNewEntity(dto);
            entity.setAliasKey(aliasKey);
            entity.setFirstSeenAt(now);
            entity.setLastSeenAt(now);
            IpoListingEntity saved = listingRepo.save(entity);
            changeEventRepo.save(event(saved.getId(), "NEW", null, dto.companyName(), now));
            appendHistory(saved.getId(), dto, now);
            upsertFinancials(saved.getId(), dto.financials());
            return;
        }

        List<IpoChangeEventEntity> events = detectChanges(existing, dto, now);
        mapper.applyUpdatable(dto, existing);
        // Keep the identity and the resolution key in step with the name/date we just accepted:
        // when the alias fallback rescued this row from a revised open date, its stored matchKey
        // still encodes the OLD date, and leaving it there would let the next poll miss on
        // matchKey again and re-enter this same fallback forever.
        existing.setMatchKey(dto.matchKey());
        existing.setAliasKey(aliasKey);
        existing.setLastSeenAt(now);
        listingRepo.save(existing);
        events.forEach(changeEventRepo::save);
        appendHistory(existing.getId(), dto, now);
        upsertFinancials(existing.getId(), dto.financials());
    }

    /**
     * The row this dto is an update to, found by resolution key rather than identity — the fallback
     * that stops one company becoming several rows.
     *
     * <p>{@code matchKey} is {@code normalize(name)|openDate}, so it changes whenever a feed
     * revises the open date or writes the name in a different house style ({@code "Co."} against
     * {@code "Company"}, {@code "&"} against {@code "and"}). Each variant used to mint a fresh row
     * that nothing connected to the original, which is what put two cards for one IPO on the list
     * and — because a duplicate pair looks ambiguous to {@code InvestorgainMatcher} — left BOTH of
     * them without a GMP.
     *
     * <p>The alias key is deliberately lossy, so a hit is only a CANDIDATE. Two guards keep it from
     * fusing genuinely different issues by the same company (an SME issue and a later mainboard
     * one share a byte-identical name):
     * <ul>
     *   <li>exactly one live candidate — anything ambiguous is left alone for the duplicate report
     *       to resolve under review, never merged silently on the ingest path;</li>
     *   <li>the candidate's dates must plausibly be the same issue: no open date on either side
     *       (nothing to contradict), or open dates within {@link #ALIAS_DATE_TOLERANCE_DAYS}.</li>
     * </ul>
     * A rejected candidate simply falls through to "insert a new row" — the previous behaviour.
     */
    private IpoListingEntity resolveByAlias(String aliasKey, IpoDto dto) {
        if (aliasKey == null) {
            return null;
        }
        List<IpoListingEntity> candidates = listingRepo.findLiveByAliasKey(aliasKey);
        if (candidates.size() != 1) {
            if (candidates.size() > 1) {
                log.debug("IPO alias fallback: '{}' (alias={}) matches {} live rows - ambiguous, "
                        + "left for the duplicate report", dto.companyName(), aliasKey, candidates.size());
            }
            return null;
        }
        IpoListingEntity candidate = candidates.get(0);
        if (!plausiblySameIssue(candidate.getOpenDate(), dto.openDate())) {
            log.debug("IPO alias fallback: '{}' (alias={}) matched row {} but open dates are {} vs {} "
                            + "- treating as a separate issue", dto.companyName(), aliasKey,
                    candidate.getId(), candidate.getOpenDate(), dto.openDate());
            return null;
        }
        log.info("IPO alias fallback: '{}' resolved to existing row {} ('{}') - open date {} -> {}, "
                        + "no duplicate created", dto.companyName(), candidate.getId(),
                candidate.getCompanyName(), candidate.getOpenDate(), dto.openDate());
        return candidate;
    }

    /**
     * Whether two open dates can be the same issue. A missing date on either side cannot
     * contradict anything (a feed routinely carries the name before the schedule), so it passes;
     * two known dates must be close enough to read as a revision rather than a separate issue.
     */
    private static boolean plausiblySameIssue(LocalDate existingOpen, LocalDate incomingOpen) {
        if (existingOpen == null || incomingOpen == null) {
            return true;
        }
        return Math.abs(ChronoUnit.DAYS.between(existingOpen, incomingOpen)) <= ALIAS_DATE_TOLERANCE_DAYS;
    }

    /**
     * UPSERTs one fiscal year's figures per row of {@code rows} (keyed by {@code (ipoId,
     * fiscalYear)} via {@link IpoFinancialRepository#findByIpoIdAndFiscalYear}): inserts a new
     * {@link IpoFinancialEntity} row if none exists yet for that fiscal year, otherwise updates it
     * IN PLACE only when a value actually differs — so re-ingesting identical financials is a
     * true no-op (no save call at all), matching the append-on-change idempotency the rest of
     * this service already guarantees for GMP/subscription. Never deletes a stale row (a fiscal
     * year dropping out of a later scrape is rare, and simplicity wins here per the brief).
     */
    private void upsertFinancials(String ipoId, List<IpoFinancialRowDto> rows) {
        if (rows == null || rows.isEmpty()) {
            return;
        }
        // Reconcile: drop any previously-stored fiscal year that the current scrape no longer
        // reports — e.g. stale rows left by an earlier parse that mis-read metric labels ("Assets",
        // "Profit After Tax", …) as periods — so the detail view/chart never shows orphaned empty
        // rows. Guarded by the empty check above, so a transient empty scrape can't wipe good data.
        Set<String> incomingYears = rows.stream()
                .map(IpoFinancialRowDto::fiscalYear)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        for (IpoFinancialEntity existing : financialRepo.findByIpoIdOrderByPeriodEndAsc(ipoId)) {
            if (!incomingYears.contains(existing.getFiscalYear())) {
                financialRepo.delete(existing);
            }
        }
        for (IpoFinancialRowDto row : rows) {
            if (row.fiscalYear() == null) {
                continue; // no usable natural key for this row
            }
            IpoFinancialEntity entity = financialRepo.findByIpoIdAndFiscalYear(ipoId, row.fiscalYear()).orElse(null);
            if (entity == null) {
                financialRepo.save(IpoFinancialEntity.builder()
                        .ipoId(ipoId)
                        .fiscalYear(row.fiscalYear())
                        .revenue(row.revenue())
                        .pat(row.pat())
                        .totalAssets(row.totalAssets())
                        .periodEnd(row.periodEnd())
                        .build());
            } else if (financialRowChanged(entity, row)) {
                entity.setRevenue(row.revenue());
                entity.setPat(row.pat());
                entity.setTotalAssets(row.totalAssets());
                entity.setPeriodEnd(row.periodEnd());
                financialRepo.save(entity);
            }
        }
    }

    private static boolean financialRowChanged(IpoFinancialEntity entity, IpoFinancialRowDto row) {
        return bigDecimalDiffers(entity.getRevenue(), row.revenue())
                || bigDecimalDiffers(entity.getPat(), row.pat())
                || bigDecimalDiffers(entity.getTotalAssets(), row.totalAssets())
                || !Objects.equals(entity.getPeriodEnd(), row.periodEnd());
    }

    /** Compares {@code dto} against {@code entity}'s pre-update state — must run before {@code applyUpdatable}. */
    private List<IpoChangeEventEntity> detectChanges(IpoListingEntity entity, IpoDto dto, Instant now) {
        List<IpoChangeEventEntity> events = new ArrayList<>();
        String ipoId = entity.getId();

        if (dto.status() != null && !Objects.equals(entity.getStatus(), dto.status())) {
            events.add(event(ipoId, "STATUS", entity.getStatus(), dto.status(), now));
        }
        if (dto.gmp() != null && bigDecimalDiffers(entity.getGmp(), dto.gmp())) {
            events.add(event(ipoId, "GMP", toPlainString(entity.getGmp()), toPlainString(dto.gmp()), now));
        }
        if (dto.allotmentStatus() != null && !Objects.equals(entity.getAllotmentStatus(), dto.allotmentStatus())) {
            events.add(event(ipoId, "ALLOTMENT", entity.getAllotmentStatus(), dto.allotmentStatus(), now));
        }

        boolean transitioningToListed = !STATUS_LISTED.equals(entity.getStatus()) && STATUS_LISTED.equals(dto.status());
        boolean listingPriceNewlySet = entity.getListingPrice() == null && dto.listingPrice() != null;
        if (transitioningToListed || listingPriceNewlySet) {
            events.add(event(ipoId, "LISTING", null, listingEventValue(dto.listingExchange(), dto.listingGainPct()), now));
        }

        return events;
    }

    /** Joins whichever of {exchange, gainPct + "%"} are non-null with a space; empty if both are null. */
    private static String listingEventValue(String exchange, BigDecimal gainPct) {
        List<String> parts = new ArrayList<>();
        if (exchange != null) {
            parts.add(exchange);
        }
        if (gainPct != null) {
            parts.add(gainPct + "%");
        }
        return String.join(" ", parts);
    }

    /** Append-on-change: only inserts a history row when the captured value actually moved. */
    private void appendHistory(String ipoId, IpoDto dto, Instant now) {
        if (dto.gmp() != null) {
            BigDecimal lastGmp = gmpHistoryRepo.findTopByIpoIdOrderByCapturedAtDesc(ipoId)
                    .map(IpoGmpHistoryEntity::getGmp)
                    .orElse(null);
            if (bigDecimalDiffers(lastGmp, dto.gmp())) {
                gmpHistoryRepo.save(IpoGmpHistoryEntity.builder()
                        .ipoId(ipoId)
                        .gmp(dto.gmp())
                        .gmpPct(dto.gmpPct())
                        .source(dto.source())
                        .capturedAt(now)
                        .build());
            }
        }
        // NOTE: subscription history is NOT written here. Investorgain owns the subscription series
        // (InvestorgainGmpService.refreshSubscription) — one authoritative day-wise row per day with
        // the full category breakdown (QIB/NII/S-NII/B-NII/RII/…). Writing NSE's per-poll snapshots
        // here too mixed two sources with different capturedAt granularity and category naming
        // (NSE "Retail" vs investorgain "RII"), so the "current" pick and the day-wise table were wrong.
    }

    private static IpoChangeEventEntity event(String ipoId, String eventType, String oldValue, String newValue, Instant now) {
        return IpoChangeEventEntity.builder()
                .ipoId(ipoId)
                .eventType(eventType)
                .oldValue(oldValue)
                .newValue(newValue)
                .createdAt(now)
                .build();
    }

    private static boolean bigDecimalDiffers(BigDecimal a, BigDecimal b) {
        if (a == null && b == null) {
            return false;
        }
        if (a == null || b == null) {
            return true;
        }
        return a.compareTo(b) != 0;
    }

    private static String toPlainString(BigDecimal value) {
        return value == null ? null : value.toPlainString();
    }

    /** Returns {@code dto} unchanged if its status is already canonical, else a copy with it swapped in. */
    private static IpoDto withCanonicalStatus(IpoDto dto) {
        String canonicalStatus = IpoStatusCanonicalizer.canonical(dto.status());
        return Objects.equals(canonicalStatus, dto.status()) ? dto : withStatus(dto, canonicalStatus);
    }

    /**
     * Fills in a date-derived status when NO source reported one (e.g. a Chittorgarh-only IPO,
     * whose list JSON has dates but no status) — so it isn't stored as "Unknown"/unfilterable.
     * Returns {@code dto} unchanged when it already has a status or no date lets us decide.
     */
    private IpoDto withDerivedStatus(IpoDto dto) {
        if (dto.status() != null) {
            return dto;
        }
        String derived = IpoStatusCanonicalizer.deriveStatus(
                dto.openDate(), dto.closeDate(), dto.listingDate(), LocalDateTime.now(clock.withZone(IST)));
        return derived == null ? dto : withStatus(dto, derived);
    }

    /**
     * Applies the Indian IPO calendar to whatever status this row currently carries.
     *
     * <p>This used to be three separate methods (hold a premature "open", promote a stale
     * "upcoming", downgrade a closed-but-still-"open") and they drifted apart: the promotion
     * refused to act without a close date while the date-only derivation was happy to call the
     * same issue open. The rule now lives once, in
     * {@link IpoStatusCanonicalizer#calendarCorrected}, and {@code IpoStatusSweepService} applies
     * the identical rule to stored rows between polls — because a transition driven purely by the
     * clock must not wait for the next poll to be noticed.
     */
    private IpoDto withCalendarStatus(IpoDto dto) {
        String corrected = IpoStatusCanonicalizer.calendarCorrected(
                dto.status(), dto.openDate(), dto.closeDate(), LocalDateTime.now(clock.withZone(IST)));
        return Objects.equals(corrected, dto.status()) ? dto : withStatus(dto, corrected);
    }

    /**
     * Computes {@code listingGainPct} from the listing price when no source reported it — the same
     * "fill in what the feeds don't carry" role {@link #withDerivedStatus} plays for status.
     *
     * <p>None of the live sources actually publish a listing gain (NSE reports {@code listingPrice}
     * but no gain, Chittorgarh's list JSON carries neither, IPO Guru doesn't document it), so
     * without this the field was only ever non-null for seeded sample data and every real listed
     * IPO rendered an empty gain. It's pure arithmetic off two fields we already store.
     *
     * <p>Measured against the TOP of the price band (falling back to a single-price issue's only
     * value): a book-built issue is allotted at the cut-off, which is the cap in all but a rare
     * under-subscribed issue — this is the same basis the public IPO trackers quote.
     */
    private static IpoDto withDerivedListingGain(IpoDto dto) {
        if (dto.listingGainPct() != null || dto.listingPrice() == null) {
            return dto;
        }
        BigDecimal issuePrice = dto.priceMax() != null ? dto.priceMax() : dto.priceMin();
        if (issuePrice == null || issuePrice.signum() <= 0) {
            return dto;
        }
        BigDecimal gainPct = dto.listingPrice().subtract(issuePrice)
                .multiply(BigDecimal.valueOf(100))
                .divide(issuePrice, 2, RoundingMode.HALF_UP);
        return new IpoDto(dto.source(), dto.matchKey(), dto.companyName(), dto.ipoType(), dto.status(),
                dto.openDate(), dto.closeDate(), dto.allotmentDate(), dto.listingDate(),
                dto.priceMin(), dto.priceMax(), dto.lotSize(), dto.issueSize(),
                dto.listingExchange(), dto.listingPrice(), gainPct,
                dto.gmp(), dto.gmpPct(), dto.subscriptionCategories(), dto.subTotal(),
                dto.allotmentStatus(), dto.registrar(), dto.registrarUrl(), dto.logoUrl(), dto.about(),
                dto.refundDate(), dto.dematDate(), dto.faceValue(), dto.freshIssue(), dto.offerForSale(),
                dto.tickerSymbol(), dto.strengths(), dto.risks(), dto.financials(),
                dto.kpis(), dto.issueObjects(), dto.leadManagers(), dto.issueDetails());
    }

    /** A copy of {@code dto} with only its status swapped — every other field carried across verbatim. */
    private static IpoDto withStatus(IpoDto dto, String status) {
        return new IpoDto(dto.source(), dto.matchKey(), dto.companyName(), dto.ipoType(), status,
                dto.openDate(), dto.closeDate(), dto.allotmentDate(), dto.listingDate(),
                dto.priceMin(), dto.priceMax(), dto.lotSize(), dto.issueSize(),
                dto.listingExchange(), dto.listingPrice(), dto.listingGainPct(),
                dto.gmp(), dto.gmpPct(), dto.subscriptionCategories(), dto.subTotal(),
                dto.allotmentStatus(), dto.registrar(), dto.registrarUrl(), dto.logoUrl(), dto.about(),
                dto.refundDate(), dto.dematDate(), dto.faceValue(), dto.freshIssue(), dto.offerForSale(),
                dto.tickerSymbol(), dto.strengths(), dto.risks(), dto.financials(),
                dto.kpis(), dto.issueObjects(), dto.leadManagers(), dto.issueDetails());
    }

    /** Returns {@code dto} unchanged if its ipoType is already canonical, else a copy with it swapped in. */
    private static IpoDto withCanonicalType(IpoDto dto) {
        String canonicalType = IpoStatusCanonicalizer.canonicalType(dto.ipoType());
        if (Objects.equals(canonicalType, dto.ipoType())) {
            return dto;
        }
        return new IpoDto(dto.source(), dto.matchKey(), dto.companyName(), canonicalType, dto.status(),
                dto.openDate(), dto.closeDate(), dto.allotmentDate(), dto.listingDate(),
                dto.priceMin(), dto.priceMax(), dto.lotSize(), dto.issueSize(),
                dto.listingExchange(), dto.listingPrice(), dto.listingGainPct(),
                dto.gmp(), dto.gmpPct(), dto.subscriptionCategories(), dto.subTotal(),
                dto.allotmentStatus(), dto.registrar(), dto.registrarUrl(), dto.logoUrl(), dto.about(),
                dto.refundDate(), dto.dematDate(), dto.faceValue(), dto.freshIssue(), dto.offerForSale(),
                dto.tickerSymbol(), dto.strengths(), dto.risks(), dto.financials(),
                dto.kpis(), dto.issueObjects(), dto.leadManagers(), dto.issueDetails());
    }
}
