package com.db.dbworld.app.tally.service;

import com.db.dbworld.app.tally.service.TallyAllocator.Allocation;
import com.db.dbworld.app.tally.service.TallyAllocator.Weight;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TallyAllocatorTest {

    private static List<String> members(int n) {
        List<String> ids = new ArrayList<>(n);
        for (int i = 0; i < n; i++) {
            // Zero-padded so lexicographic order matches numeric order; the tiebreak is by
            // member id, and a test whose ids sort differently to how they read would be
            // confusing to debug.
            ids.add("m%02d".formatted(i));
        }
        return ids;
    }

    private static BigDecimal sum(List<Allocation> allocations) {
        return allocations.stream().map(Allocation::amount).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private static BigDecimal rupees(String v) {
        return new BigDecimal(v);
    }

    // ── The case everyone gets wrong ─────────────────────────────────────────

    @Test
    void hundredAcrossThree_keepsTheStrayPaisa() {
        List<Allocation> out = TallyAllocator.allocateEqually(rupees("100.00"), members(3));

        assertThat(out).extracting(a -> a.amount().toPlainString())
                .containsExactly("33.34", "33.33", "33.33");
        assertThat(sum(out)).isEqualByComparingTo(rupees("100.00"));
    }

    /** The mirror-image failure: naive per-share rounding over-allocates here, not under. */
    @Test
    void hundredAcrossSix_doesNotOverAllocate() {
        List<Allocation> out = TallyAllocator.allocateEqually(rupees("100.00"), members(6));

        assertThat(sum(out)).isEqualByComparingTo(rupees("100.00"));
        assertThat(out).extracting(a -> a.amount().toPlainString())
                .containsExactly("16.67", "16.67", "16.67", "16.67", "16.66", "16.66");
    }

    // ── The invariant, over the whole remainder space ────────────────────────

    /**
     * Every total from 1 paisa to ₹100, across every group size up to 12. That covers each
     * possible remainder many times over, which is the only part of the arithmetic that can
     * actually go wrong.
     */
    @Test
    void everySplitPreservesTheTotal() {
        for (int n = 1; n <= 12; n++) {
            List<String> ids = members(n);
            for (long paise = 1; paise <= 10_000; paise++) {
                BigDecimal total = TallyAllocator.fromPaise(paise);
                List<Allocation> out = TallyAllocator.allocateEqually(total, ids);

                assertThat(sum(out))
                        .as("%s across %d", total.toPlainString(), n)
                        .isEqualByComparingTo(total);
                assertThat(out).hasSize(n);
            }
        }
    }

    /** No share may differ from another by more than a single paisa in an equal split. */
    @Test
    void equalSplitSharesDifferByAtMostOnePaisa() {
        for (int n = 2; n <= 12; n++) {
            for (long paise = 1; paise <= 2_000; paise++) {
                List<Allocation> out = TallyAllocator.allocateEqually(TallyAllocator.fromPaise(paise), members(n));
                long min = out.stream().mapToLong(a -> TallyAllocator.toPaise(a.amount())).min().orElseThrow();
                long max = out.stream().mapToLong(a -> TallyAllocator.toPaise(a.amount())).max().orElseThrow();
                assertThat(max - min).as("%d paise across %d", paise, n).isLessThanOrEqualTo(1);
            }
        }
    }

    // ── Determinism ──────────────────────────────────────────────────────────

    /**
     * Voiding an expense re-runs this allocator to write reversal entries. If the second run
     * disagreed with the first by a paisa, the append-only ledger would carry that error for
     * good.
     */
    @Test
    void repeatedCallsAllocateIdentically() {
        for (long paise = 1; paise <= 500; paise++) {
            BigDecimal total = TallyAllocator.fromPaise(paise);
            assertThat(TallyAllocator.allocateEqually(total, members(7)))
                    .isEqualTo(TallyAllocator.allocateEqually(total, members(7)));
        }
    }

    /** The tiebreak is the member id, never the order the participants happened to arrive in. */
    @Test
    void tiesAreBrokenByMemberId_notInsertionOrder() {
        BigDecimal total = rupees("100.00");

        List<Allocation> ascending = TallyAllocator.allocateEqually(total, List.of("a", "b", "c"));
        List<Allocation> descending = TallyAllocator.allocateEqually(total, List.of("c", "b", "a"));

        // Same member is short-changed either way, even though the lists are reversed.
        assertThat(extra(ascending)).isEqualTo("a");
        assertThat(extra(descending)).isEqualTo("a");
    }

    private static String extra(List<Allocation> out) {
        long max = out.stream().mapToLong(a -> TallyAllocator.toPaise(a.amount())).max().orElseThrow();
        return out.stream().filter(a -> TallyAllocator.toPaise(a.amount()) == max)
                .map(Allocation::memberId).findFirst().orElseThrow();
    }

    /** The UI renders participants in the order it sent them; reordering breaks the preview. */
    @Test
    void preservesTheCallersOrder() {
        List<Allocation> out = TallyAllocator.allocateEqually(rupees("10.00"), List.of("z", "a", "m"));

        assertThat(out).extracting(Allocation::memberId).containsExactly("z", "a", "m");
    }

    // ── Weighted splits ──────────────────────────────────────────────────────

    @Test
    void sharesSplit_dividesInProportion() {
        List<Allocation> out = TallyAllocator.allocate(rupees("300.00"), List.of(
                new Weight("a", new BigDecimal("2")),
                new Weight("b", new BigDecimal("1"))));

        assertThat(out).extracting(a -> a.amount().toPlainString()).containsExactly("200.00", "100.00");
    }

    @Test
    void percentageSplit_holdsTheTotalEvenWhenItCannotDivideCleanly() {
        List<Allocation> out = TallyAllocator.allocate(rupees("100.00"), List.of(
                new Weight("a", new BigDecimal("33.3333")),
                new Weight("b", new BigDecimal("33.3333")),
                new Weight("c", new BigDecimal("33.3334"))));

        assertThat(sum(out)).isEqualByComparingTo(rupees("100.00"));
    }

    @Test
    void weightedSplitsPreserveTheTotalAcrossManyAmounts() {
        List<Weight> weights = List.of(
                new Weight("a", new BigDecimal("1")),
                new Weight("b", new BigDecimal("2")),
                new Weight("c", new BigDecimal("3")),
                new Weight("d", new BigDecimal("0.5")));

        for (long paise = 1; paise <= 5_000; paise++) {
            BigDecimal total = TallyAllocator.fromPaise(paise);
            assertThat(sum(TallyAllocator.allocate(total, weights)))
                    .as("%s weighted", total.toPlainString())
                    .isEqualByComparingTo(total);
        }
    }

    /** A participant carrying no weight owes nothing, and must not absorb a stray paisa. */
    @Test
    void zeroWeightParticipantOwesNothing() {
        List<Allocation> out = TallyAllocator.allocate(rupees("100.00"), List.of(
                new Weight("a", BigDecimal.ONE),
                new Weight("b", BigDecimal.ZERO)));

        assertThat(out).extracting(a -> a.amount().toPlainString()).containsExactly("100.00", "0.00");
    }

    // ── Edge cases and rejections ────────────────────────────────────────────

    @Test
    void singleParticipantTakesTheWholeAmount() {
        assertThat(TallyAllocator.allocateEqually(rupees("77.77"), List.of("a")))
                .extracting(a -> a.amount().toPlainString()).containsExactly("77.77");
    }

    @Test
    void zeroTotalAllocatesZeroToEveryone() {
        assertThat(TallyAllocator.allocateEqually(rupees("0.00"), members(4)))
                .extracting(a -> a.amount().toPlainString())
                .containsExactly("0.00", "0.00", "0.00", "0.00");
    }

    /**
     * Sub-paisa input is rejected rather than rounded. The column is DECIMAL(12,2), so a
     * third decimal would be truncated on the way in — and MySQL errors where H2 rounds,
     * which would make the two databases disagree.
     */
    @Test
    void rejectsAmountsFinerThanAPaisa() {
        assertThatThrownBy(() -> TallyAllocator.allocateEqually(rupees("10.001"), members(2)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("whole number of paise");
    }

    @Test
    void rejectsNegativeTotal() {
        assertThatThrownBy(() -> TallyAllocator.allocateEqually(rupees("-1.00"), members(2)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("negative");
    }

    @Test
    void rejectsNegativeWeight() {
        assertThatThrownBy(() -> TallyAllocator.allocate(rupees("10.00"),
                List.of(new Weight("a", new BigDecimal("-1")))))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("negative");
    }

    @Test
    void rejectsWeightsThatAllSumToZero() {
        assertThatThrownBy(() -> TallyAllocator.allocate(rupees("10.00"), List.of(
                new Weight("a", BigDecimal.ZERO),
                new Weight("b", BigDecimal.ZERO))))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("more than zero");
    }

    @Test
    void rejectsAnEmptyParticipantList() {
        assertThatThrownBy(() -> TallyAllocator.allocateEqually(rupees("10.00"), List.of()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("at least one participant");
    }

    @Test
    void everyAllocationComesBackAtScaleTwo() {
        TallyAllocator.allocateEqually(rupees("100.00"), members(3))
                .forEach(a -> assertThat(a.amount().scale()).isEqualTo(2));
    }

    /* ====================== the debtor-by-payer matrix ====================== */

    /**
     * Both margins, in one helper, because that pair IS the property.
     *
     * <p>Rows adding up is the easy half and was never broken. Columns adding up is the half
     * that was, and the half the ledger relies on when it drops the diagonal.
     */
    private static void assertMarginsHold(List<Weight> debtors, List<Weight> payers,
                                          Map<String, Map<String, BigDecimal>> matrix) {
        for (Weight debtor : debtors) {
            BigDecimal row = matrix.get(debtor.memberId()).values().stream()
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            assertThat(row).as("row for %s", debtor.memberId())
                    .isEqualByComparingTo(debtor.weight());
        }
        for (Weight payer : payers) {
            BigDecimal column = matrix.values().stream()
                    .map(row -> row.get(payer.memberId()))
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            assertThat(column).as("column for %s", payer.memberId())
                    .isEqualByComparingTo(payer.weight());
        }
    }

    @Test
    void theMatrixSplitsProportionallyWhenItDividesCleanly() {
        var debtors = List.of(new Weight("m01", rupees("300.00")), new Weight("m02", rupees("300.00")));
        var payers = List.of(new Weight("m01", rupees("400.00")), new Weight("m02", rupees("200.00")));

        var matrix = TallyAllocator.allocateMatrix(debtors, payers);

        // m01 owes 300, and m01 funded two thirds of the bill, so 200 of it traces to m01.
        assertThat(matrix.get("m01").get("m01")).isEqualByComparingTo("200.00");
        assertThat(matrix.get("m01").get("m02")).isEqualByComparingTo("100.00");
        assertMarginsHold(debtors, payers, matrix);
    }

    @Test
    void theCaseThatWasBroken() {
        // Three payers of 200 on a 600 bill; the fourth owes 450 and the payers owe 50 each.
        // Splitting one debtor's 50 three ways is 16.666..., so it has to round -- and rounding
        // each debtor's row on its own gave the first payer a spare paisa from EVERY debtor.
        var debtors = List.of(
                new Weight("m01", rupees("450.00")), new Weight("m02", rupees("50.00")),
                new Weight("m03", rupees("50.00")), new Weight("m04", rupees("50.00")));
        var payers = List.of(
                new Weight("m02", rupees("200.00")), new Weight("m03", rupees("200.00")),
                new Weight("m04", rupees("200.00")));

        var matrix = TallyAllocator.allocateMatrix(debtors, payers);

        assertMarginsHold(debtors, payers, matrix);

        // What the ledger then computes: column minus row, with the diagonal cancelling.
        for (String member : List.of("m02", "m03", "m04")) {
            BigDecimal owedToThem = matrix.values().stream()
                    .map(row -> row.get(member)).reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal theyOwe = matrix.get(member).values().stream()
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            assertThat(owedToThem.subtract(theyOwe)).as("net for %s", member)
                    .isEqualByComparingTo("150.00");
        }
    }

    @Test
    void theMatrixHoldsBothMarginsAcrossAwkwardShapes() {
        // Amounts and party sizes chosen to force rounding in both directions. Failures are
        // collected rather than asserted in the loop, for the reason tallyMath.test.js is.
        List<String> broken = new ArrayList<>();
        int[][] shapes = { {3, 3}, {4, 3}, {3, 4}, {7, 2}, {2, 7}, {5, 5}, {9, 4} };

        for (int[] shape : shapes) {
            for (int totalPaise : new int[] { 1, 7, 100, 333, 1000, 10_001, 99_999 }) {
                var debtors = spread(shape[0], totalPaise, "d");
                var payers = spread(shape[1], totalPaise, "p");
                try {
                    var matrix = TallyAllocator.allocateMatrix(debtors, payers);
                    for (Weight d : debtors) {
                        BigDecimal row = matrix.get(d.memberId()).values().stream()
                                .reduce(BigDecimal.ZERO, BigDecimal::add);
                        if (row.compareTo(d.weight()) != 0) {
                            broken.add("row %s of %dx%d @ %d".formatted(
                                    d.memberId(), shape[0], shape[1], totalPaise));
                        }
                    }
                    for (Weight pay : payers) {
                        BigDecimal column = matrix.values().stream()
                                .map(r -> r.get(pay.memberId()))
                                .reduce(BigDecimal.ZERO, BigDecimal::add);
                        if (column.compareTo(pay.weight()) != 0) {
                            broken.add("column %s of %dx%d @ %d".formatted(
                                    pay.memberId(), shape[0], shape[1], totalPaise));
                        }
                    }
                } catch (RuntimeException e) {
                    broken.add("%dx%d @ %d threw %s".formatted(
                            shape[0], shape[1], totalPaise, e.getMessage()));
                }
            }
        }
        assertThat(broken.stream().limit(20).toList())
                .as("%d margin(s) did not hold", broken.size())
                .isEmpty();
    }

    @Test
    void theSameMatrixComesBackEveryTime() {
        // A correction re-runs this to write reversal entries into an append-only table, so a
        // second run that disagreed by a paisa would preserve the difference forever.
        var debtors = List.of(new Weight("m01", rupees("33.33")), new Weight("m02", rupees("33.34")),
                new Weight("m03", rupees("33.33")));
        var payers = List.of(new Weight("m01", rupees("50.00")), new Weight("m02", rupees("50.00")));

        var first = TallyAllocator.allocateMatrix(debtors, payers);
        for (int i = 0; i < 20; i++) {
            assertThat(TallyAllocator.allocateMatrix(debtors, payers)).isEqualTo(first);
        }
    }

    @Test
    void aMatrixWhoseSidesDisagreeIsRefused() {
        assertThatThrownBy(() -> TallyAllocator.allocateMatrix(
                List.of(new Weight("m01", rupees("100.00"))),
                List.of(new Weight("m02", rupees("90.00")))))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("same total");
    }

    @Test
    void aZeroTotalMatrixIsAllZeroesRatherThanAnError() {
        // A fully delegated expense can leave a debtor owing nothing; it should not throw.
        var matrix = TallyAllocator.allocateMatrix(
                List.of(new Weight("m01", rupees("0.00"))),
                List.of(new Weight("m02", rupees("0.00"))));

        assertThat(matrix.get("m01").get("m02")).isEqualByComparingTo("0.00");
    }

    /** {@code count} members sharing {@code totalPaise}, deliberately unevenly. */
    private static List<Weight> spread(int count, int totalPaise, String prefix) {
        List<Weight> weights = new ArrayList<>(count);
        long each = totalPaise / count;
        long leftover = totalPaise - each * count;
        for (int i = 0; i < count; i++) {
            long paise = each + (i < leftover ? 1 : 0);
            weights.add(new Weight("%s%02d".formatted(prefix, i + 1),
                    BigDecimal.valueOf(paise, 2)));
        }
        return weights;
    }
}
