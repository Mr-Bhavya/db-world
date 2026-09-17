package com.db.dbworld.app.tally.service.importer;

import com.db.dbworld.app.tally.dto.AddMemberRequest;
import com.db.dbworld.app.tally.dto.CreateExpenseRequest;
import com.db.dbworld.app.tally.dto.CreateGroupRequest;
import com.db.dbworld.app.tally.dto.RecordSettlementRequest;
import com.db.dbworld.app.tally.dto.SplitwiseImportRequest;
import com.db.dbworld.app.tally.dto.SplitwiseImportResultDto;
import com.db.dbworld.app.tally.dto.SplitwisePersonDto;
import com.db.dbworld.app.tally.dto.SplitwisePreviewDto;
import com.db.dbworld.app.tally.entity.TallyMethod;
import com.db.dbworld.app.tally.service.TallyBalanceService;
import com.db.dbworld.app.tally.service.TallyExpenseService;
import com.db.dbworld.app.tally.service.TallyGroupService;
import com.db.dbworld.app.tally.service.TallyMemberService;
import com.db.dbworld.app.tally.service.TallySettlementService;
import com.db.dbworld.core.exception.DbWorldException;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Bringing a Splitwise group into db-tally.
 *
 * <p>Two steps on purpose. {@link #preview} reads the file and writes nothing, because the
 * people in it are names and nothing else — no emails, no ids — so somebody has to say who they
 * are, and because any row the file could not describe exactly should be seen before it is
 * committed rather than discovered in a balance six months later.
 *
 * <p>{@link #importGroup} then writes the lot in one transaction and <b>reconciles against the
 * export's own closing balances</b>. If a single paisa disagrees the whole thing rolls back. That
 * check is the reason this is safe to offer at all: the ledger is append-only, so an import that
 * lands slightly wrong cannot be corrected, only buried under adjusting entries.
 *
 * <p>Everything goes through the ordinary services — {@code TallyExpenseService},
 * {@code TallySettlementService} — rather than writing rows directly. An import that bypassed
 * them would skip the allocator, the ledger, the balance rules and the activity log, and would
 * be the one path in the module capable of producing a group the rest of it considers invalid.
 */
@Log4j2
@Service
@RequiredArgsConstructor
public class TallyImportService {

    /** Expense dates in the file are plain dates; a settlement needs a moment. */
    private static final ZoneId ZONE = ZoneId.of("Asia/Kolkata");

    private final TallyGroupService groups;
    private final TallyMemberService members;
    private final TallyExpenseService expenses;
    private final TallySettlementService settlements;
    private final TallyBalanceService balances;

    /* ============================== preview ============================== */

    public SplitwisePreviewDto preview(String csv) {
        SplitwiseCsv.Parsed parsed = SplitwiseCsv.parse(csv);

        int people = parsed.people().size();
        List<BigDecimal> paid = zeroes(people);
        List<BigDecimal> consumed = zeroes(people);
        BigDecimal spend = BigDecimal.ZERO;

        for (var entry : parsed.entries()) {
            if (entry.payment()) continue;   // moving money is not spending it
            spend = spend.add(entry.cost());
            for (int i = 0; i < people; i++) {
                paid.set(i, paid.get(i).add(entry.paid().get(i)));
                consumed.set(i, consumed.get(i).add(entry.owed().get(i)));
            }
        }

        List<SplitwisePersonDto> rows = new ArrayList<>(people);
        for (int i = 0; i < people; i++) {
            rows.add(new SplitwisePersonDto(parsed.people().get(i), paid.get(i), consumed.get(i),
                    parsed.totals().isEmpty() ? null : parsed.totals().get(i)));
        }

        var dates = parsed.entries().stream().map(SplitwiseCsv.Entry::date).sorted().toList();
        return new SplitwisePreviewDto(
                parsed.currency(),
                (int) parsed.entries().stream().filter(e -> !e.payment()).count(),
                (int) parsed.entries().stream().filter(SplitwiseCsv.Entry::payment).count(),
                (int) parsed.entries().stream().filter(SplitwiseCsv.Entry::payerInferred).count(),
                dates.getFirst(),
                dates.getLast(),
                spend,
                rows,
                parsed.warnings(),
                !parsed.totals().isEmpty());
    }

    /* ============================== import ============================== */

    @Transactional
    public SplitwiseImportResultDto importGroup(Long userId, SplitwiseImportRequest request) {
        SplitwiseCsv.Parsed parsed = SplitwiseCsv.parse(request.csv());
        Map<String, SplitwiseImportRequest.PersonMapping> mapping = mappingFor(parsed, request);

        var group = groups.create(userId, new CreateGroupRequest(
                request.groupName(), request.groupCategory(), request.icon()));

        // One member id per CSV column, in column order, so every row's arrays line up with it.
        List<String> memberIds = roster(userId, group.id(), group.myMemberId(), parsed, mapping);

        int created = 0;
        int settled = 0;
        for (int row = 0; row < parsed.entries().size(); row++) {
            var entry = parsed.entries().get(row);
            if (entry.payment()) {
                recordPayment(userId, group.id(), memberIds, entry, row);
                settled++;
            } else {
                recordExpense(userId, group.id(), memberIds, entry, row);
                created++;
            }
        }

        reconcile(group.id(), memberIds, parsed);

        BigDecimal spend = parsed.entries().stream()
                .filter(e -> !e.payment())
                .map(SplitwiseCsv.Entry::cost)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        log.info("Imported {} expenses and {} payments from a Splitwise export into group {}",
                created, settled, group.id());

        return new SplitwiseImportResultDto(
                groups.get(userId, group.id()),
                created,
                settled,
                (int) parsed.entries().stream().filter(SplitwiseCsv.Entry::payerInferred).count(),
                true,
                spend,
                parsed.warnings());
    }

    /**
     * Checks every column against the mapping, before anything is written.
     *
     * <p>A missing or duplicated name is refused rather than defaulted. Quietly inventing a
     * ghost for a column somebody forgot to map would put a stranger in the group holding real
     * debts, under a name taken from a file.
     */
    private Map<String, SplitwiseImportRequest.PersonMapping> mappingFor(
            SplitwiseCsv.Parsed parsed, SplitwiseImportRequest request) {

        Map<String, SplitwiseImportRequest.PersonMapping> byName = new LinkedHashMap<>();
        for (var person : request.people()) {
            if (byName.put(person.csvName(), person) != null) {
                throw bad("%s appears twice in the people you matched.".formatted(person.csvName()));
            }
        }
        List<String> unmatched = parsed.people().stream().filter(n -> !byName.containsKey(n)).toList();
        if (!unmatched.isEmpty()) {
            throw bad("Nobody was chosen for %s.".formatted(String.join(", ", unmatched)));
        }
        List<String> extra = byName.keySet().stream().filter(n -> !parsed.people().contains(n)).toList();
        if (!extra.isEmpty()) {
            throw bad("%s is not a column in that export.".formatted(String.join(", ", extra)));
        }

        // Two columns pointing at one account would collide on (group_id, user_id) halfway
        // through, after the group already exists.
        Map<Long, String> seen = new LinkedHashMap<>();
        for (var person : request.people()) {
            if (person.userId() == null) continue;
            String already = seen.put(person.userId(), person.csvName());
            if (already != null) {
                throw bad("%s and %s cannot both be the same person."
                        .formatted(already, person.csvName()));
            }
        }
        return byName;
    }

    /**
     * Creates a member per column and returns their ids in column order.
     *
     * <p>The caller is already in the group — creating one puts them in as owner — so a column
     * that maps to them reuses that row instead of adding a second. Otherwise the unique key on
     * {@code (group_id, user_id)} would reject it after the group had been written.
     */
    private List<String> roster(Long userId, String groupId, String myMemberId,
                                SplitwiseCsv.Parsed parsed,
                                Map<String, SplitwiseImportRequest.PersonMapping> mapping) {
        List<String> ids = new ArrayList<>(parsed.people().size());
        for (String name : parsed.people()) {
            var person = mapping.get(name);
            String display = person.displayName() == null || person.displayName().isBlank()
                    ? name : person.displayName().trim();

            if (userId.equals(person.userId())) {
                ids.add(myMemberId);
            } else {
                ids.add(members.add(userId, groupId,
                        new AddMemberRequest(person.userId(), display, null)).id());
            }
        }
        return ids;
    }

    private void recordExpense(Long userId, String groupId, List<String> memberIds,
                               SplitwiseCsv.Entry entry, int row) {
        List<CreateExpenseRequest.PayerInput> payers = new ArrayList<>();
        List<CreateExpenseRequest.ParticipantInput> participants = new ArrayList<>();

        for (int i = 0; i < memberIds.size(); i++) {
            // Only the people actually in it. A payer of zero is rejected by validation anyway,
            // and a participant owing zero would leave a share row saying nothing.
            if (entry.paid().get(i).signum() > 0) {
                payers.add(new CreateExpenseRequest.PayerInput(memberIds.get(i), entry.paid().get(i)));
            }
            if (entry.owed().get(i).signum() > 0) {
                participants.add(new CreateExpenseRequest.ParticipantInput(
                        memberIds.get(i), entry.owed().get(i), null, null, null));
            }
        }

        // EXACT, never EQUAL. Two of the sixteen expenses in the file this was built against are
        // unequal splits, and an equal division would reconcile perfectly while recording the
        // wrong person as having eaten the difference.
        expenses.create(userId, groupId, new CreateExpenseRequest(
                entry.description(),
                entry.cost(),
                TallyMethod.EXACT,
                category(entry.category()),
                entry.date(),
                notes(entry),
                "sw-%d".formatted(row),
                payers,
                participants));
    }

    private void recordPayment(Long userId, String groupId, List<String> memberIds,
                               SplitwiseCsv.Entry entry, int row) {
        int from = entry.payerIndex();
        int to = entry.payeeIndex();
        settlements.record(userId, groupId, new RecordSettlementRequest(
                memberIds.get(from),
                memberIds.get(to),
                entry.cost(),
                "Imported",
                // Splitwise exports a payment, not which loan it repaid -- it has no such
                // concept -- so an imported settlement is unallocated like any settle-up.
                null,
                entry.date().atStartOfDay(ZONE).toInstant(),
                "sw-%d".formatted(row)));
    }

    /**
     * The check that makes this safe to offer.
     *
     * <p>Every member's balance in the new group is compared against the export's own closing
     * figure, and any difference rolls the whole import back. Both sides use the same sign
     * convention — positive means they are owed — so this is a direct comparison and not a
     * translation that could itself be wrong.
     */
    private void reconcile(String groupId, List<String> memberIds, SplitwiseCsv.Parsed parsed) {
        if (parsed.totals().isEmpty()) {
            log.warn("Splitwise export had no closing balances; import into {} not reconciled",
                    groupId);
            return;
        }
        for (int i = 0; i < memberIds.size(); i++) {
            BigDecimal actual = balances.netOf(groupId, memberIds.get(i));
            BigDecimal expected = parsed.totals().get(i);
            if (actual.compareTo(expected) != 0) {
                throw new DbWorldException(HttpStatus.UNPROCESSABLE_ENTITY,
                        ("That import did not add up, so nothing was saved. %s should end on %s "
                         + "but came to %s.").formatted(parsed.people().get(i),
                                expected.toPlainString(), actual.toPlainString()));
            }
        }
    }

    /**
     * Splitwise's category, kept only when this module offers something like it.
     *
     * <p>Its vocabulary is its own — "Bus/train", "Dining out", "Car" — and inventing a mapping
     * would guess wrong often enough to be worse than leaving the field empty, where at least the
     * description still says what it was. The raw value is kept because it is closer to the truth
     * than any translation of it, and the category column is free text here.
     */
    private String category(String category) {
        return category == null || category.isBlank() || "General".equalsIgnoreCase(category)
                ? null : category;
    }

    /** Says so on the row itself when the split was this importer's reading rather than a record. */
    private String notes(SplitwiseCsv.Entry entry) {
        return entry.payerInferred()
                ? "Imported from Splitwise. Several people paid for this one, and the export only "
                  + "recorded each person's net — so who owes what is exact, but how much of it "
                  + "they each consumed is an estimate."
                : "Imported from Splitwise.";
    }

    private static List<BigDecimal> zeroes(int count) {
        List<BigDecimal> values = new ArrayList<>(count);
        for (int i = 0; i < count; i++) {
            values.add(BigDecimal.ZERO);
        }
        return values;
    }

    private static DbWorldException bad(String message) {
        return new DbWorldException(HttpStatus.BAD_REQUEST, message);
    }
}
