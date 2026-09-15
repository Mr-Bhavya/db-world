package com.db.dbworld.app.tally.service;

import com.db.dbworld.app.tally.dto.TallyReportBucketDto;
import com.db.dbworld.app.tally.dto.TallyReportCategoryDto;
import com.db.dbworld.app.tally.dto.TallyReportExpenseDto;
import com.db.dbworld.app.tally.dto.TallyReportLedgerDto;
import com.db.dbworld.app.tally.dto.TallyReportPeriod;
import com.db.dbworld.app.tally.dto.TallySpendingReportDto;
import com.db.dbworld.app.tally.entity.TallyGroupEntity;
import com.db.dbworld.app.tally.entity.TallyGroupKind;
import com.db.dbworld.app.tally.entity.TallyGroupMemberEntity;
import com.db.dbworld.app.tally.repository.TallyExpenseShareRepository;
import com.db.dbworld.app.tally.repository.TallyExpenseShareRepository.ConsumedShare;
import com.db.dbworld.app.tally.repository.TallyGroupMemberRepository;
import com.db.dbworld.app.tally.repository.TallyGroupRepository;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * "Where did my money go this week?" — the caller's own spending, across every ledger at once.
 *
 * <p>This is the one read in the module that deliberately ignores group boundaries. Everywhere
 * else a group is the unit: you open one and see what you owe in it. Here the question is about
 * the person, so personal, one-to-one and shared ledgers are added together and the group only
 * survives as a breakdown row.
 *
 * <p>Read-only throughout, and it writes nothing to the activity log. Looking at a report is not
 * an event in the group's history.
 */
@Log4j2
@Service
public class TallyReportService {

    /**
     * Where "today" is.
     *
     * <p>Expense dates are plain {@link LocalDate}s a person picked off a calendar, so the
     * boundary between "this month" and "last" has to be the one they are living in. A UTC clock
     * would put the server five and a half hours behind them and quietly file every evening's
     * spending — from half past five onwards — into the previous day, which at the turn of a
     * month moves it into the previous report.
     */
    private static final ZoneId ZONE = ZoneId.of("Asia/Kolkata");

    /** Group key for shares whose expense had no category, mapped back to null on the way out. */
    private static final String UNCATEGORISED = "";

    private final TallyGroupMemberRepository members;
    private final TallyGroupRepository groups;
    private final TallyExpenseShareRepository shares;
    private final Clock clock;

    @Autowired
    public TallyReportService(TallyGroupMemberRepository members,
                              TallyGroupRepository groups,
                              TallyExpenseShareRepository shares) {
        this(members, groups, shares, Clock.systemUTC());
    }

    /** Test-friendly constructor with an injectable clock for a deterministic "today". */
    TallyReportService(TallyGroupMemberRepository members,
                       TallyGroupRepository groups,
                       TallyExpenseShareRepository shares,
                       Clock clock) {
        this.members = members;
        this.groups = groups;
        this.shares = shares;
        this.clock = clock;
    }

    /**
     * @param anchor any date inside the period to report on; today when null. The caller names a
     *               day and the server decides which week or month that day belongs to, so
     *               "previous" means the same thing on both sides.
     */
    @Transactional(readOnly = true)
    public TallySpendingReportDto spending(Long userId, TallyReportPeriod period, LocalDate anchor) {
        // withZone rather than trusting the clock's own zone: a fixed clock handed in by a test
        // carries whatever zone it was built with, and the report's day boundaries must be IST
        // either way. Same shape as HomeSummaryService.
        LocalDate today = LocalDate.now(clock.withZone(ZONE));
        LocalDate at = anchor != null ? anchor : today;

        // Every membership, departed ones included: see TallyGroupMemberRepository#findByUserId.
        List<TallyGroupMemberEntity> mine = members.findByUserId(userId);
        if (mine.isEmpty()) {
            // Nothing to query against, and `in ()` is not a filter worth asking the database to
            // evaluate. A new user gets the same empty shape as a quiet month.
            return assemble(period, at, today, List.of(), BigDecimal.ZERO, Map.of());
        }

        Set<String> groupIds = mine.stream()
                .map(TallyGroupMemberEntity::getGroupId).collect(Collectors.toSet());
        Set<String> memberIds = mine.stream()
                .map(TallyGroupMemberEntity::getId).collect(Collectors.toSet());

        List<ConsumedShare> rows =
                shares.findConsumed(groupIds, memberIds, period.startOf(at), period.endOf(at));

        LocalDate previous = period.previousAnchor(at);
        BigDecimal previousTotal = shares.sumConsumed(
                groupIds, memberIds, period.startOf(previous), period.endOf(previous));

        // Only the ledgers that actually saw spending -- being in a group you did not spend in
        // this month is not a row worth drawing.
        Set<String> spentIn = rows.stream()
                .map(ConsumedShare::getGroupId).collect(Collectors.toSet());
        Map<String, TallyGroupEntity> byId = spentIn.isEmpty() ? Map.of()
                : groups.findByIdIn(spentIn).stream()
                        .collect(Collectors.toMap(TallyGroupEntity::getId, Function.identity()));

        return assemble(period, at, today, rows, previousTotal, byId);
    }

    /* ============================== assembly ============================== */

    /**
     * One construction path, so an empty report is the same shape as a full one rather than a
     * second version of it that can drift.
     */
    private TallySpendingReportDto assemble(TallyReportPeriod period,
                                            LocalDate at,
                                            LocalDate today,
                                            List<ConsumedShare> rows,
                                            BigDecimal previousTotal,
                                            Map<String, TallyGroupEntity> groupById) {
        BigDecimal total = rows.stream()
                .map(ConsumedShare::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        LocalDate next = period.nextAnchor(at);

        return new TallySpendingReportDto(
                period,
                period.startOf(at),
                period.endOf(at),
                period.previousAnchor(at),
                // No forward step into a period that has not begun: there is nothing there yet,
                // and an enabled button that always lands on zero reads as a bug.
                period.startOf(next).isAfter(today) ? null : next,
                currencyOf(groupById.values()),
                total,
                previousTotal == null ? BigDecimal.ZERO : previousTotal,
                dailyAverage(total, period.elapsedDays(at, today)),
                (int) rows.stream().map(ConsumedShare::getExpenseId).distinct().count(),
                buckets(period, at, rows),
                categories(rows),
                ledgers(rows, groupById),
                biggest(rows));
    }

    private List<TallyReportBucketDto> buckets(TallyReportPeriod period,
                                               LocalDate at,
                                               List<ConsumedShare> rows) {
        return period.bucketsOf(at).stream()
                .map(bucket -> new TallyReportBucketDto(bucket.start(), bucket.end(),
                        rows.stream()
                                .filter(r -> bucket.contains(r.getExpenseDate()))
                                .map(ConsumedShare::getAmount)
                                .reduce(BigDecimal.ZERO, BigDecimal::add)))
                .toList();
    }

    private List<TallyReportCategoryDto> categories(List<ConsumedShare> rows) {
        return rows.stream()
                // groupingBy will not take a null key, hence the sentinel; the DTO gets the null
                // back so the client keeps owning what an uncategorised expense is called.
                .collect(Collectors.groupingBy(
                        r -> r.getCategory() == null ? UNCATEGORISED : r.getCategory(),
                        Collectors.reducing(BigDecimal.ZERO, ConsumedShare::getAmount, BigDecimal::add)))
                .entrySet().stream()
                .map(e -> new TallyReportCategoryDto(
                        UNCATEGORISED.equals(e.getKey()) ? null : e.getKey(), e.getValue()))
                .sorted(Comparator.comparing(TallyReportCategoryDto::amount).reversed())
                .toList();
    }

    private List<TallyReportLedgerDto> ledgers(List<ConsumedShare> rows,
                                               Map<String, TallyGroupEntity> groupById) {
        return rows.stream()
                .collect(Collectors.groupingBy(ConsumedShare::getGroupId,
                        Collectors.reducing(BigDecimal.ZERO, ConsumedShare::getAmount, BigDecimal::add)))
                .entrySet().stream()
                .map(e -> {
                    // Groups are archived, never deleted, and there are no foreign keys here --
                    // so a missing row should be impossible, and degrades to a placeholder name
                    // rather than a 500 that loses the whole report over one breakdown line.
                    TallyGroupEntity group = groupById.get(e.getKey());
                    return new TallyReportLedgerDto(
                            e.getKey(),
                            group != null ? group.getName() : "Unknown",
                            group != null ? group.getKind() : TallyGroupKind.GROUP,
                            group != null ? group.getIcon() : null,
                            e.getValue());
                })
                .sorted(Comparator.comparing(TallyReportLedgerDto::amount).reversed())
                .toList();
    }

    private TallyReportExpenseDto biggest(List<ConsumedShare> rows) {
        return rows.stream()
                .max(Comparator.comparing(ConsumedShare::getAmount))
                .map(r -> new TallyReportExpenseDto(r.getExpenseId(), r.getGroupId(),
                        r.getDescription(), r.getCategory(), r.getExpenseDate(), r.getAmount()))
                .orElse(null);
    }

    /**
     * Total over the days that have actually elapsed.
     *
     * <p>Zero days means the period has not started, so there is no rate yet — not an average of
     * nothing, which would be a divide by zero.
     */
    private BigDecimal dailyAverage(BigDecimal total, long elapsedDays) {
        return elapsedDays <= 0 ? BigDecimal.ZERO
                : total.divide(BigDecimal.valueOf(elapsedDays), 2, RoundingMode.HALF_UP);
    }

    /**
     * The currency the total is in.
     *
     * <p>Only INR can be created today, so this is really a guard for later: the moment a second
     * currency exists, adding two ledgers together stops meaning anything, and this at least
     * stops the report claiming rupees over a mixed total.
     */
    private String currencyOf(Collection<TallyGroupEntity> involved) {
        Set<String> distinct = involved.stream()
                .map(TallyGroupEntity::getCurrency)
                .collect(Collectors.toSet());
        return distinct.size() == 1 ? distinct.iterator().next() : "INR";
    }
}
