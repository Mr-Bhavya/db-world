package com.db.dbworld.app.tally.service;

import com.db.dbworld.app.tally.service.TallyAllocator.Allocation;
import com.db.dbworld.app.tally.service.TallyAllocator.Weight;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

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
}
