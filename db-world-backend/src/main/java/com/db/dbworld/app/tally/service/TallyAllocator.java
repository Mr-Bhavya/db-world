package com.db.dbworld.app.tally.service;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Divides a money amount across weighted participants so the parts sum to the whole,
 * exactly, every time.
 *
 * <p>The obvious implementation — {@code total.divide(n, 2, HALF_UP)} per participant — is
 * wrong in <em>both</em> directions. ₹100 across 3 gives 33.33 × 3 = ₹99.99, a paisa short.
 * ₹100 across 6 gives 16.67 × 6 = ₹100.02, two paise over. Either way the group's balances
 * no longer close to zero, and after a few hundred expenses nobody can settle up because the
 * arithmetic itself has drifted. Each individual expense looks fine, which is what makes it
 * miserable to diagnose later.
 *
 * <p>This uses the largest-remainder (Hamilton) method in integer paise:
 * <ol>
 *   <li>Give everyone the floor of their exact entitlement.</li>
 *   <li>Count the paise left over — always fewer than the number of participants.</li>
 *   <li>Hand them out one each, to whoever was rounded down hardest.</li>
 * </ol>
 *
 * <p><b>Determinism matters as much as exactness.</b> Ties are broken by member id, never by
 * insertion order, so the same expense always allocates the same way. Voiding an expense
 * writes reversal entries by re-running this allocator; if the second run disagreed with the
 * first by a paisa, the append-only ledger would keep that error forever.
 */
public final class TallyAllocator {

    private TallyAllocator() {}

    /** One participant's claim on the total. {@code weight} is 1 apiece for an equal split. */
    public record Weight(String memberId, BigDecimal weight) {}

    /** What that participant ends up owing, always at scale 2. */
    public record Allocation(String memberId, BigDecimal amount) {}

    /**
     * Splits {@code total} across {@code weights} in proportion, losing nothing.
     *
     * @throws IllegalArgumentException if the total is negative or has sub-paisa precision,
     *                                  the weights are empty, or they sum to zero
     */
    public static List<Allocation> allocate(BigDecimal total, List<Weight> weights) {
        if (total == null || weights == null || weights.isEmpty()) {
            throw new IllegalArgumentException("A split needs a total and at least one participant");
        }
        if (total.signum() < 0) {
            throw new IllegalArgumentException("Cannot split a negative amount: " + total);
        }

        // longValueExact throws rather than silently truncating, so an amount carrying
        // sub-paisa precision is rejected here instead of being quietly rounded away and
        // reappearing as a balance that will not close.
        long totalPaise = toPaise(total);

        BigDecimal weightSum = weights.stream()
                .map(TallyAllocator::validWeight)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        if (weightSum.signum() <= 0) {
            throw new IllegalArgumentException("Split weights must add up to more than zero");
        }

        // Entitlements are computed as exact rationals rather than decimals: a third of
        // anything has no finite decimal form, and rounding it here is the very error this
        // class exists to avoid. Scaling both sides by the weight denominators keeps the
        // arithmetic in whole numbers.
        int weightScale = weights.stream().mapToInt(w -> w.weight().scale()).max().orElse(0);
        BigInteger scaledSum = weightSum.setScale(weightScale, RoundingMode.UNNECESSARY).unscaledValue();
        BigInteger total_ = BigInteger.valueOf(totalPaise);

        record Draft(String memberId, long base, BigInteger remainder) {}
        List<Draft> drafts = new ArrayList<>(weights.size());
        long allocated = 0;

        for (Weight w : weights) {
            BigInteger scaledWeight = w.weight().setScale(weightScale, RoundingMode.UNNECESSARY).unscaledValue();
            BigInteger[] divMod = total_.multiply(scaledWeight).divideAndRemainder(scaledSum);
            long base = divMod[0].longValueExact();
            drafts.add(new Draft(w.memberId(), base, divMod[1]));
            allocated += base;
        }

        // Strictly fewer left over than there are participants, because each was short by
        // less than one paisa.
        long shortfall = totalPaise - allocated;

        List<Draft> byEntitlement = new ArrayList<>(drafts);
        byEntitlement.sort(Comparator
                .comparing(Draft::remainder).reversed()
                .thenComparing(Draft::memberId));

        Set<String> getsExtra = byEntitlement.stream()
                .limit(shortfall)
                .map(Draft::memberId)
                .collect(Collectors.toSet());

        // Rebuilt in the caller's order: the participant list is the order the UI renders,
        // and reordering it here would make the preview disagree with what was saved.
        List<Allocation> result = drafts.stream()
                .map(d -> new Allocation(d.memberId(), fromPaise(d.base() + (getsExtra.contains(d.memberId()) ? 1 : 0))))
                .toList();

        // The whole point of the class, asserted rather than assumed. A future edit that
        // breaks the invariant fails here, on the way out, rather than as an unsettleable
        // balance three months from now.
        BigDecimal sum = result.stream().map(Allocation::amount).reduce(BigDecimal.ZERO, BigDecimal::add);
        if (sum.compareTo(total) != 0) {
            throw new IllegalStateException(
                    "Split did not preserve the total: " + sum + " allocated from " + total);
        }
        return result;
    }

    /** Equal split — the common case, and the one where the remainder bites hardest. */
    public static List<Allocation> allocateEqually(BigDecimal total, List<String> memberIds) {
        return allocate(total, memberIds.stream().map(id -> new Weight(id, BigDecimal.ONE)).toList());
    }

    /** Paise as a whole number; rejects anything finer than the currency can express. */
    public static long toPaise(BigDecimal amount) {
        try {
            return amount.movePointRight(2).longValueExact();
        } catch (ArithmeticException e) {
            throw new IllegalArgumentException(
                    "Amount must be a whole number of paise, got: " + amount, e);
        }
    }

    /** Back to money, always at scale 2 so it round-trips through a DECIMAL(12,2) column. */
    public static BigDecimal fromPaise(long paise) {
        return BigDecimal.valueOf(paise, 2);
    }

    private static BigDecimal validWeight(Weight w) {
        if (w.weight() == null || w.weight().signum() < 0) {
            throw new IllegalArgumentException("Split weight cannot be negative for " + w.memberId());
        }
        return w.weight();
    }
}
