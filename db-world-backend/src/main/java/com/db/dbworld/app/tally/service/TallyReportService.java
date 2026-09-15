package com.db.dbworld.app.tally.service;

import com.db.dbworld.app.tally.dto.TallyGroupReportDto;
import com.db.dbworld.app.tally.dto.TallyGroupReportMemberDto;
import com.db.dbworld.app.tally.dto.TallyReportBucketDto;
import com.db.dbworld.app.tally.dto.TallyReportCategoryDto;
import com.db.dbworld.app.tally.dto.TallyReportExpenseDto;
import com.db.dbworld.app.tally.dto.TallyReportLedgerDto;
import com.db.dbworld.app.tally.dto.TallyReportPeriod;
import com.db.dbworld.app.tally.dto.TallySpendingReportDto;
import com.db.dbworld.app.tally.entity.TallyExpenseStatus;
import com.db.dbworld.app.tally.entity.TallyGroupEntity;
import com.db.dbworld.app.tally.entity.TallyGroupKind;
import com.db.dbworld.app.tally.entity.TallyGroupMemberEntity;
import com.db.dbworld.app.tally.repository.TallyExpensePayerRepository;
import com.db.dbworld.app.tally.repository.TallyExpenseRepository;
import com.db.dbworld.app.tally.repository.TallyExpenseShareRepository;
import com.db.dbworld.app.tally.repository.TallyExpenseShareRepository.ConsumedShare;
import com.db.dbworld.app.tally.repository.TallyGroupMemberRepository;
import com.db.dbworld.app.tally.repository.TallyGroupRepository;
import com.db.dbworld.app.tally.repository.TallyLedgerEntryRepository.MemberTotal;
import com.db.dbworld.app.tally.repository.TallySettlementRepository;
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
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * The two spending reports: yours across every ledger, and one group's.
 *
 * <p>They answer genuinely different questions and the difference is load-bearing.
 * {@link #spending} is about a person — "where did my money go" — so it adds personal,
 * one-to-one and shared ledgers together, counts only the caller's own share of each expense,
 * and never mentions what anybody handed over. {@link #group} is about a group — "what did this
 * cost us, and who has been carrying it" — so it counts expenses at full value and reports paid
 * alongside consumed, because inside a group both are fair questions.
 *
 * <p>What they share is the shape of the answer: bucket it over the period, rank it by category,
 * name the biggest item. That work is done once, over {@link Line}, whichever source the rows
 * came from.
 *
 * <p>Read-only throughout, and neither writes to the activity log. Looking at a report is not an
 * event in the group's history.
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

    private final TallyAccessService access;
    private final TallyGroupMemberRepository members;
    private final TallyGroupRepository groups;
    private final TallyExpenseRepository expenses;
    private final TallyExpenseShareRepository shares;
    private final TallyExpensePayerRepository payers;
    private final TallySettlementRepository settlements;
    private final Clock clock;

    @Autowired
    public TallyReportService(TallyAccessService access,
                              TallyGroupMemberRepository members,
                              TallyGroupRepository groups,
                              TallyExpenseRepository expenses,
                              TallyExpenseShareRepository shares,
                              TallyExpensePayerRepository payers,
                              TallySettlementRepository settlements) {
        this(access, members, groups, expenses, shares, payers, settlements, Clock.systemUTC());
    }

    /** Test-friendly constructor with an injectable clock for a deterministic "today". */
    TallyReportService(TallyAccessService access,
                       TallyGroupMemberRepository members,
                       TallyGroupRepository groups,
                       TallyExpenseRepository expenses,
                       TallyExpenseShareRepository shares,
                       TallyExpensePayerRepository payers,
                       TallySettlementRepository settlements,
                       Clock clock) {
        this.access = access;
        this.members = members;
        this.groups = groups;
        this.expenses = expenses;
        this.shares = shares;
        this.payers = payers;
        this.settlements = settlements;
        this.clock = clock;
    }

    /* ============================== mine, everywhere ============================== */

    /**
     * What the caller consumed across every ledger they are in.
     *
     * @param anchor any date inside the period to report on; today when null. The caller names a
     *               day and the server decides which week or month that day belongs to, so
     *               "previous" means the same thing on both sides.
     */
    @Transactional(readOnly = true)
    public TallySpendingReportDto spending(Long userId, TallyReportPeriod period, LocalDate anchor) {
        LocalDate today = today();
        LocalDate at = anchor != null ? anchor : today;

        // Every membership, departed ones included: see TallyGroupMemberRepository#findByUserId.
        List<TallyGroupMemberEntity> mine = members.findByUserId(userId);
        if (mine.isEmpty()) {
            // Nothing to query against, and `in ()` is not a filter worth asking the database to
            // evaluate. A new user gets the same empty shape as a quiet month.
            return assembleMine(period, at, today, List.of(), BigDecimal.ZERO, Map.of());
        }

        Set<String> groupIds = mine.stream()
                .map(TallyGroupMemberEntity::getGroupId).collect(Collectors.toSet());
        Set<String> memberIds = mine.stream()
                .map(TallyGroupMemberEntity::getId).collect(Collectors.toSet());

        List<Line> lines = shares
                .findConsumed(groupIds, memberIds, period.startOf(at), period.endOf(at))
                .stream().map(TallyReportService::lineOf).toList();

        LocalDate previous = period.previousAnchor(at);
        BigDecimal previousTotal = shares.sumConsumed(
                groupIds, memberIds, period.startOf(previous), period.endOf(previous));

        // Only the ledgers that actually saw spending -- being in a group you did not spend in
        // this month is not a row worth drawing.
        Set<String> spentIn = lines.stream().map(Line::groupId).collect(Collectors.toSet());
        Map<String, TallyGroupEntity> byId = spentIn.isEmpty() ? Map.of()
                : groups.findByIdIn(spentIn).stream()
                        .collect(Collectors.toMap(TallyGroupEntity::getId, Function.identity()));

        return assembleMine(period, at, today, lines, previousTotal, byId);
    }

    /* ============================== one group ============================== */

    /**
     * What one group spent, and who carried it.
     *
     * <p>Access goes through the same membership choke point as every other read in the module,
     * so a non-member gets the group's own 404 rather than a report shaped like a permission
     * error. Archived groups are readable: a finished trip is exactly the thing somebody wants a
     * report of.
     */
    @Transactional(readOnly = true)
    public TallyGroupReportDto group(Long userId, String groupId,
                                     TallyReportPeriod period, LocalDate anchor) {
        TallyGroupEntity group = access.requireVisibleGroup(userId, groupId);
        TallyGroupMemberEntity me = access.requireMembership(userId, groupId);

        LocalDate today = today();
        LocalDate at = anchor != null ? anchor : today;
        LocalDate from = period.startOf(at);
        LocalDate to = period.endOf(at);

        List<Line> lines = expenses
                .findByGroupIdAndStatusAndExpenseDateBetween(groupId, TallyExpenseStatus.ACTIVE, from, to)
                .stream()
                .map(e -> new Line(e.getId(), e.getGroupId(), e.getExpenseDate(),
                        e.getDescription(), e.getCategory(), e.getTotalAmount()))
                .toList();

        LocalDate previous = period.previousAnchor(at);
        BigDecimal previousTotal =
                expenses.sumTotalBetween(groupId, period.startOf(previous), period.endOf(previous));

        Map<String, BigDecimal> paid = totalsByMember(payers.sumPaidByGroupBetween(groupId, from, to));
        Map<String, BigDecimal> consumed =
                totalsByMember(shares.sumConsumedByGroupBetween(groupId, from, to));

        // settled_at is an instant, so the report's dates are widened to the same zone the rest
        // of the report is reckoned in, half-open so the last day is whole.
        BigDecimal settled = settlements.sumSettledBetween(groupId,
                from.atStartOfDay(ZONE).toInstant(),
                to.plusDays(1).atStartOfDay(ZONE).toInstant());

        LocalDate next = period.nextAnchor(at);
        BigDecimal total = sum(lines);

        return new TallyGroupReportDto(
                period, from, to,
                period.previousAnchor(at),
                period.startOf(next).isAfter(today) ? null : next,
                group.getCurrency(),
                total,
                orZero(previousTotal),
                consumed.getOrDefault(me.getId(), BigDecimal.ZERO),
                orZero(settled),
                dailyAverage(total, period.elapsedDays(at, today)),
                countExpenses(lines),
                buckets(period, at, lines),
                categories(lines),
                memberRows(groupId, paid, consumed),
                biggest(lines));
    }

    /**
     * Per-member rows for the group report, biggest consumer first.
     *
     * <p>Only members who paid or consumed something in the period. Listing the whole roster
     * would pad a quiet month with rows of two zeroes; somebody genuinely involved shows up
     * through whichever column they landed in, which is why the keys are a union rather than
     * either side alone — a person who paid for a meal they did not eat belongs here, and so
     * does one who ate a meal they did not pay for.
     */
    private List<TallyGroupReportMemberDto> memberRows(String groupId,
                                                       Map<String, BigDecimal> paid,
                                                       Map<String, BigDecimal> consumed) {
        Set<String> involved = new LinkedHashSet<>(paid.keySet());
        involved.addAll(consumed.keySet());
        if (involved.isEmpty()) return List.of();

        // The full roster, departed members included -- their name still has to render on the
        // expenses they were part of, exactly as it does in the expense feed.
        Map<String, String> nameById = members.findByGroupId(groupId).stream()
                .collect(Collectors.toMap(TallyGroupMemberEntity::getId,
                        TallyGroupMemberEntity::getDisplayName));

        return involved.stream()
                .map(id -> new TallyGroupReportMemberDto(
                        id,
                        nameById.getOrDefault(id, "Unknown"),
                        paid.getOrDefault(id, BigDecimal.ZERO),
                        consumed.getOrDefault(id, BigDecimal.ZERO)))
                .sorted(Comparator.comparing(TallyGroupReportMemberDto::consumed).reversed())
                .toList();
    }

    private static Map<String, BigDecimal> totalsByMember(List<MemberTotal> totals) {
        return totals.stream()
                .collect(Collectors.toMap(MemberTotal::getMemberId, MemberTotal::getTotal));
    }

    /* ============================== assembly ============================== */

    /**
     * One expense as a report sees it, whichever report is asking.
     *
     * <p>{@code amount} is the caller's share in the personal report and the whole bill in the
     * group one. That is the only difference between them at this level, which is why the
     * bucketing, the category ranking and "the biggest one" are written once.
     */
    private record Line(String expenseId, String groupId, LocalDate date,
                        String description, String category, BigDecimal amount) {}

    private static Line lineOf(ConsumedShare share) {
        return new Line(share.getExpenseId(), share.getGroupId(), share.getExpenseDate(),
                share.getDescription(), share.getCategory(), share.getAmount());
    }

    /**
     * One construction path for the personal report, so an empty one is the same shape as a full
     * one rather than a second version of it that can drift.
     */
    private TallySpendingReportDto assembleMine(TallyReportPeriod period,
                                                LocalDate at,
                                                LocalDate today,
                                                List<Line> lines,
                                                BigDecimal previousTotal,
                                                Map<String, TallyGroupEntity> groupById) {
        BigDecimal total = sum(lines);
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
                orZero(previousTotal),
                dailyAverage(total, period.elapsedDays(at, today)),
                countExpenses(lines),
                buckets(period, at, lines),
                categories(lines),
                ledgers(lines, groupById),
                biggest(lines));
    }

    private static BigDecimal sum(List<Line> lines) {
        return lines.stream().map(Line::amount).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    /** Distinct expenses, not rows — one expense can contribute several shares. */
    private static int countExpenses(List<Line> lines) {
        return (int) lines.stream().map(Line::expenseId).distinct().count();
    }

    private List<TallyReportBucketDto> buckets(TallyReportPeriod period,
                                               LocalDate at,
                                               List<Line> lines) {
        return period.bucketsOf(at).stream()
                .map(bucket -> new TallyReportBucketDto(bucket.start(), bucket.end(),
                        lines.stream()
                                .filter(line -> bucket.contains(line.date()))
                                .map(Line::amount)
                                .reduce(BigDecimal.ZERO, BigDecimal::add)))
                .toList();
    }

    private List<TallyReportCategoryDto> categories(List<Line> lines) {
        return lines.stream()
                // groupingBy will not take a null key, hence the sentinel; the DTO gets the null
                // back so the client keeps owning what an uncategorised expense is called.
                .collect(Collectors.groupingBy(
                        line -> line.category() == null ? UNCATEGORISED : line.category(),
                        Collectors.reducing(BigDecimal.ZERO, Line::amount, BigDecimal::add)))
                .entrySet().stream()
                .map(e -> new TallyReportCategoryDto(
                        UNCATEGORISED.equals(e.getKey()) ? null : e.getKey(), e.getValue()))
                .sorted(Comparator.comparing(TallyReportCategoryDto::amount).reversed())
                .toList();
    }

    private List<TallyReportLedgerDto> ledgers(List<Line> lines,
                                               Map<String, TallyGroupEntity> groupById) {
        return lines.stream()
                .collect(Collectors.groupingBy(Line::groupId,
                        Collectors.reducing(BigDecimal.ZERO, Line::amount, BigDecimal::add)))
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

    private TallyReportExpenseDto biggest(List<Line> lines) {
        return lines.stream()
                .max(Comparator.comparing(Line::amount))
                .map(line -> new TallyReportExpenseDto(line.expenseId(), line.groupId(),
                        line.description(), line.category(), line.date(), line.amount()))
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
     * The currency a cross-ledger total is in.
     *
     * <p>Only INR can be created today, so this is really a guard for later: the moment a second
     * currency exists, adding two ledgers together stops meaning anything, and this at least
     * stops the report claiming rupees over a mixed total. The group report has no such problem
     * — it reads the one group's own currency.
     */
    private String currencyOf(Collection<TallyGroupEntity> involved) {
        Set<String> distinct = involved.stream()
                .map(TallyGroupEntity::getCurrency)
                .collect(Collectors.toSet());
        return distinct.size() == 1 ? distinct.iterator().next() : "INR";
    }

    /**
     * Today, in {@link #ZONE}.
     *
     * <p>{@code withZone} rather than trusting the clock's own zone: a fixed clock handed in by a
     * test carries whatever zone it was built with, and the report's day boundaries must be IST
     * either way. Same shape as {@code HomeSummaryService}.
     */
    private LocalDate today() {
        return LocalDate.now(clock.withZone(ZONE));
    }

    private static BigDecimal orZero(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }
}
