package com.db.dbworld.app.ipo.service;

import com.db.dbworld.app.ipo.dto.IpoDto;
import com.db.dbworld.app.ipo.dto.IpoFinancialRowDto;
import com.db.dbworld.app.ipo.entity.IpoChangeEventEntity;
import com.db.dbworld.app.ipo.entity.IpoFinancialEntity;
import com.db.dbworld.app.ipo.entity.IpoGmpHistoryEntity;
import com.db.dbworld.app.ipo.entity.IpoListingEntity;
import com.db.dbworld.app.ipo.entity.IpoSubscriptionHistoryEntity;
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
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

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

    private static final String STATUS_LISTED = "listed";

    /** Indian IPO calendar zone — status boundaries (open/close/listing) flip at IST midnight. */
    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");

    private final IpoListingRepository listingRepo;
    private final IpoGmpHistoryRepository gmpHistoryRepo;
    private final IpoSubscriptionHistoryRepository subHistoryRepo;
    private final IpoChangeEventRepository changeEventRepo;
    private final IpoFinancialRepository financialRepo;
    private final IpoMapper mapper;
    private final Clock clock;

    @Autowired
    public IpoIngestService(IpoListingRepository listingRepo, IpoGmpHistoryRepository gmpHistoryRepo,
                             IpoSubscriptionHistoryRepository subHistoryRepo, IpoChangeEventRepository changeEventRepo,
                             IpoFinancialRepository financialRepo, IpoMapper mapper) {
        this(listingRepo, gmpHistoryRepo, subHistoryRepo, changeEventRepo, financialRepo, mapper, Clock.systemUTC());
    }

    /** Test-friendly constructor with an injectable clock for deterministic {@code now()}. */
    IpoIngestService(IpoListingRepository listingRepo, IpoGmpHistoryRepository gmpHistoryRepo,
                      IpoSubscriptionHistoryRepository subHistoryRepo, IpoChangeEventRepository changeEventRepo,
                      IpoFinancialRepository financialRepo, IpoMapper mapper, Clock clock) {
        this.listingRepo = listingRepo;
        this.gmpHistoryRepo = gmpHistoryRepo;
        this.subHistoryRepo = subHistoryRepo;
        this.changeEventRepo = changeEventRepo;
        this.financialRepo = financialRepo;
        this.mapper = mapper;
        this.clock = clock;
    }

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
        IpoDto dto = withDerivedStatus(withCanonicalType(withCanonicalStatus(rawDto)));
        Instant now = clock.instant();
        IpoListingEntity existing = listingRepo.findByMatchKey(dto.matchKey()).orElse(null);

        if (existing == null) {
            IpoListingEntity entity = mapper.toNewEntity(dto);
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
        existing.setLastSeenAt(now);
        listingRepo.save(existing);
        events.forEach(changeEventRepo::save);
        appendHistory(existing.getId(), dto, now);
        upsertFinancials(existing.getId(), dto.financials());
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
        if (dto.subTotal() != null && bigDecimalDiffers(entity.getSubTotal(), dto.subTotal())) {
            events.add(event(ipoId, "SUBSCRIPTION", toPlainString(entity.getSubTotal()), toPlainString(dto.subTotal()), now));
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
        if (dto.subTotal() != null) {
            BigDecimal lastTotal = subHistoryRepo.findTopByIpoIdOrderByCapturedAtDesc(ipoId)
                    .map(IpoSubscriptionHistoryEntity::getTotal)
                    .orElse(null);
            if (bigDecimalDiffers(lastTotal, dto.subTotal())) {
                subHistoryRepo.save(IpoSubscriptionHistoryEntity.builder()
                        .ipoId(ipoId)
                        .categoriesJson(IpoSubscriptionJson.toJson(dto.subscriptionCategories()))
                        .total(dto.subTotal())
                        .source(dto.source())
                        .capturedAt(now)
                        .build());
            }
        }
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
        if (Objects.equals(canonicalStatus, dto.status())) {
            return dto;
        }
        return new IpoDto(dto.source(), dto.matchKey(), dto.companyName(), dto.ipoType(), canonicalStatus,
                dto.openDate(), dto.closeDate(), dto.allotmentDate(), dto.listingDate(),
                dto.priceMin(), dto.priceMax(), dto.lotSize(), dto.issueSize(),
                dto.listingExchange(), dto.listingPrice(), dto.listingGainPct(),
                dto.gmp(), dto.gmpPct(), dto.subscriptionCategories(), dto.subTotal(),
                dto.allotmentStatus(), dto.registrar(), dto.registrarUrl(), dto.logoUrl(), dto.about(),
                dto.refundDate(), dto.dematDate(), dto.faceValue(), dto.freshIssue(), dto.offerForSale(),
                dto.tickerSymbol(), dto.strengths(), dto.risks(), dto.financials());
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
                dto.openDate(), dto.closeDate(), dto.listingDate(), LocalDate.now(clock.withZone(IST)));
        if (derived == null) {
            return dto;
        }
        return new IpoDto(dto.source(), dto.matchKey(), dto.companyName(), dto.ipoType(), derived,
                dto.openDate(), dto.closeDate(), dto.allotmentDate(), dto.listingDate(),
                dto.priceMin(), dto.priceMax(), dto.lotSize(), dto.issueSize(),
                dto.listingExchange(), dto.listingPrice(), dto.listingGainPct(),
                dto.gmp(), dto.gmpPct(), dto.subscriptionCategories(), dto.subTotal(),
                dto.allotmentStatus(), dto.registrar(), dto.registrarUrl(), dto.logoUrl(), dto.about(),
                dto.refundDate(), dto.dematDate(), dto.faceValue(), dto.freshIssue(), dto.offerForSale(),
                dto.tickerSymbol(), dto.strengths(), dto.risks(), dto.financials());
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
                dto.tickerSymbol(), dto.strengths(), dto.risks(), dto.financials());
    }
}
