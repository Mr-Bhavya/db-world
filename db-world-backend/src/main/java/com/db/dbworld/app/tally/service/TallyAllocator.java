package com.db.dbworld.app.tally.service;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
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

    /**
     * Splits every debtor's liability across every payer in one pass, preserving <b>both</b>
     * margins: each debtor's row adds up to what they owe, and each payer's column adds up to
     * what they put in.
     *
     * <h2>Why this cannot be done a row at a time</h2>
     * Allocating each debtor separately is correct per debtor and wrong per payer. The weights
     * and the tie-break are the same on every pass, so every row rounds the same way, and the
     * first payer by member id collects the spare paisa from <em>every</em> debtor. Three payers
     * of 200 on a 600 bill, each also owing 50: every debtor's 50 splits 16.67/16.67/16.66, and
     * the payers end up on 150.01, 150.01 and 149.98 instead of 150 each.
     *
     * <p>That error is invisible to a closure check, which is what makes it dangerous — the
     * paisa moves between two members rather than disappearing, so the group still sums to zero
     * while two people's balances are wrong.
     *
     * <h2>Why both margins matter</h2>
     * The caller drops the diagonal, because the part of a bill a debtor funded themselves is
     * not a debt they owe anybody. That subtraction is only safe when the margins hold: a
     * member's net is {@code sum(column) - sum(row)}, the diagonal appears in both, so removing
     * it changes nothing. Round the rows only and the column no longer equals what they paid,
     * and the diagonal stops cancelling.
     *
     * <p>Rounded by largest remainder over the whole matrix, then the leftover paise are handed
     * out one at a time to the cell with the largest remainder whose row <em>and</em> column
     * both still want one. A cell like that always exists while any deficit remains, because the
     * two totals are equal. Ordering is by remainder and then by the two member ids, so the same
     * expense always produces the same matrix — re-posting a correction that disagreed with its
     * original by a paisa would write the difference into an append-only table.
     *
     * @param debtors who owes what, keyed by member. Must sum to the same total as {@code payers}.
     * @param payers  who paid what, keyed by member.
     * @return {@code debtorId -> payerId -> amount}, including the diagonal, in the order given.
     */
    public static Map<String, Map<String, BigDecimal>> allocateMatrix(List<Weight> debtors,
                                                                      List<Weight> payers) {
        if (debtors == null || payers == null || debtors.isEmpty() || payers.isEmpty()) {
            throw new IllegalArgumentException("A matrix split needs at least one of each side");
        }
        long[] rowTotal = debtors.stream().mapToLong(d -> toPaise(validWeight(d))).toArray();
        long[] colTotal = payers.stream().mapToLong(p -> toPaise(validWeight(p))).toArray();

        long total = Arrays.stream(rowTotal).sum();
        if (total != Arrays.stream(colTotal).sum()) {
            throw new IllegalArgumentException(
                    "What is owed and what was paid must come to the same total");
        }
        int rows = rowTotal.length;
        int cols = colTotal.length;
        long[][] cell = new long[rows][cols];

        if (total == 0) {
            return matrixOf(debtors, payers, cell);
        }

        // The ideal share of cell (i, j) is owed_i * paid_j / total. Kept as an exact quotient
        // and remainder rather than a decimal, for the same reason allocate() does: a third of
        // anything has no finite decimal form and rounding it here is the error being avoided.
        long[] rowShort = new long[rows];
        long[] colShort = new long[cols];
        record Candidate(int row, int col, long remainder, String rowId, String colId) {}
        List<Candidate> candidates = new ArrayList<>(rows * cols);

        for (int i = 0; i < rows; i++) {
            for (int j = 0; j < cols; j++) {
                long numerator = rowTotal[i] * colTotal[j];
                cell[i][j] = numerator / total;
                candidates.add(new Candidate(i, j, numerator % total,
                        debtors.get(i).memberId(), payers.get(j).memberId()));
            }
        }
        for (int i = 0; i < rows; i++) {
            long assigned = 0;
            for (int j = 0; j < cols; j++) {
                assigned += cell[i][j];
            }
            rowShort[i] = rowTotal[i] - assigned;
        }
        for (int j = 0; j < cols; j++) {
            long assigned = 0;
            for (int i = 0; i < rows; i++) {
                assigned += cell[i][j];
            }
            colShort[j] = colTotal[j] - assigned;
        }

        candidates.sort(Comparator.comparingLong(Candidate::remainder).reversed()
                .thenComparing(Candidate::rowId)
                .thenComparing(Candidate::colId));

        long outstanding = Arrays.stream(rowShort).sum();
        while (outstanding > 0) {
            boolean progressed = false;
            for (Candidate c : candidates) {
                if (outstanding == 0) {
                    break;
                }
                if (rowShort[c.row()] > 0 && colShort[c.col()] > 0) {
                    cell[c.row()][c.col()]++;
                    rowShort[c.row()]--;
                    colShort[c.col()]--;
                    outstanding--;
                    progressed = true;
                }
            }
            if (!progressed) {
                // Unreachable while the two totals agree, which is checked above. Here so that a
                // future change that broke the invariant fails loudly instead of spinning.
                throw new IllegalStateException(
                        "Could not settle the last " + outstanding + " paise of an expense");
            }
        }
        return matrixOf(debtors, payers, cell);
    }

    private static Map<String, Map<String, BigDecimal>> matrixOf(List<Weight> debtors,
                                                                 List<Weight> payers,
                                                                 long[][] cell) {
        Map<String, Map<String, BigDecimal>> out = new LinkedHashMap<>();
        for (int i = 0; i < debtors.size(); i++) {
            Map<String, BigDecimal> row = new LinkedHashMap<>();
            for (int j = 0; j < payers.size(); j++) {
                row.put(payers.get(j).memberId(), fromPaise(cell[i][j]));
            }
            out.put(debtors.get(i).memberId(), row);
        }
        return out;
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
