package com.db.dbworld.app.tally.service.importer;

import com.db.dbworld.core.exception.DbWorldException;
import org.springframework.http.HttpStatus;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;

/**
 * Reads a Splitwise group export into something this module can post.
 *
 * <h2>What the file actually contains</h2>
 * <pre>
 * Date,Description,Category,Cost,Currency,Jaykishan Dudhrejiya,Bhavya Dudhia,...
 *
 * 2023-08-23,Train Tickets,Bus/train,8250.00,INR,6187.50,-2062.50,-2062.50,-2062.50
 * 2023-08-24,rishi s. paid Jaykishan D.,Payment,2062.50,INR,-2062.50,0.00,0.00,2062.50
 *
 * 2026-09-15,Total balance, , ,INR,-150.00,0.00,0.00,150.00
 * </pre>
 * One column per person, holding their <b>net</b> for that row — what they paid minus what they
 * owed. Blank lines appear between sections, and the last row is a running total rather than
 * anything that happened.
 *
 * <h2>Why the net columns are enough, nearly always</h2>
 * A net is a difference, so on the face of it the two halves cannot be recovered from it: with
 * {@code n} people there are {@code 2n} unknowns and only {@code n + 1} equations. A pays 100 on
 * a 50/50 split produces exactly the same nets as A paying 75 while B pays 25 and owes 75.
 *
 * <p>But that only bites when more than one person has a <em>positive</em> net. Somebody with a
 * negative net paid nothing — otherwise their payment would have offset it — so their share is
 * simply {@code -net}. Subtract those from the cost and the remainder is what the single payer
 * consumed, and they paid the whole bill. Every figure closes with no guessing, including
 * unequal splits, which is why this imports exact amounts and never an equal division.
 *
 * <p>With two or more positive nets the remainder has to be divided somehow, and this splits it
 * evenly among them — flagged on the row, because it is the one number here that is a guess.
 * <b>Balances are unaffected either way</b>: {@code paid = net + owed} by construction, so
 * each person's net effect is preserved however the remainder is attributed. Only "who consumed
 * it" is uncertain, never what anybody owes.
 */
public final class SplitwiseCsv {

    /** Splitwise files are a few kilobytes; this is only here to bound a hostile upload. */
    public static final int MAX_CHARS = 1_000_000;

    private static final String PAYMENT_CATEGORY = "Payment";
    private static final String TOTAL_ROW = "total balance";
    private static final int PEOPLE_COLUMN = 5;

    private SplitwiseCsv() {}

    /**
     * One row of the export, already resolved into payers and shares.
     *
     * @param paid  by person, positionally matching {@link Parsed#people()}. Sums to {@code cost}.
     * @param owed  by person, same order. Also sums to {@code cost}.
     * @param payerInferred true when the row had several positive nets, so the division of what
     *                      the payers themselves consumed is this importer's choice rather than
     *                      something the file recorded.
     */
    public record Entry(LocalDate date,
                        String description,
                        String category,
                        BigDecimal cost,
                        boolean payment,
                        List<BigDecimal> paid,
                        List<BigDecimal> owed,
                        boolean payerInferred) {

        /** For a payment: who handed the money over. The only person with a positive net. */
        public int payerIndex() {
            for (int i = 0; i < paid.size(); i++) {
                if (paid.get(i).signum() > 0) return i;
            }
            return -1;
        }

        /** For a payment: who received it. The only person with a negative net. */
        public int payeeIndex() {
            for (int i = 0; i < owed.size(); i++) {
                if (owed.get(i).signum() > 0) return i;
            }
            return -1;
        }
    }

    /**
     * @param totals the file's own closing balances, per person. The import reconciles against
     *               these and refuses if they do not match — a money import that silently lands
     *               slightly wrong is worse than one that fails.
     */
    public record Parsed(List<String> people,
                         String currency,
                         List<Entry> entries,
                         List<BigDecimal> totals,
                         List<String> warnings) {}

    public static Parsed parse(String csv) {
        if (csv == null || csv.isBlank()) {
            throw bad("That file is empty.");
        }
        if (csv.length() > MAX_CHARS) {
            throw bad("That file is too large to be a Splitwise export.");
        }

        List<List<String>> rows = readRows(csv);
        if (rows.isEmpty()) {
            throw bad("That file has no rows.");
        }

        List<String> header = rows.getFirst();
        if (header.size() <= PEOPLE_COLUMN || !"Date".equalsIgnoreCase(header.getFirst().trim())) {
            throw bad("That does not look like a Splitwise export — expected a header starting "
                    + "with Date, then a column per person.");
        }
        List<String> people = header.subList(PEOPLE_COLUMN, header.size()).stream()
                .map(String::trim).toList();
        if (people.stream().anyMatch(String::isEmpty)) {
            throw bad("One of the people columns in that file has no name.");
        }

        List<String> warnings = new ArrayList<>();
        List<Entry> entries = new ArrayList<>();
        List<BigDecimal> totals = null;
        String currency = null;

        for (List<String> row : rows.subList(1, rows.size())) {
            if (isBlank(row)) continue;

            String description = at(row, 1).trim();
            // The closing balances, not an event. Recognised by its description because its date
            // is the export's and its cost column is blank.
            if (TOTAL_ROW.equalsIgnoreCase(description)) {
                totals = nets(row, people.size());
                continue;
            }

            String rowCurrency = at(row, 4).trim();
            if (!rowCurrency.isEmpty()) {
                if (currency == null) {
                    currency = rowCurrency;
                } else if (!currency.equals(rowCurrency)) {
                    // Summing two currencies is meaningless and this module only holds one per
                    // group, so this is refused rather than warned about.
                    throw bad("That export mixes %s and %s. Only one currency can be imported."
                            .formatted(currency, rowCurrency));
                }
            }

            entries.add(entry(row, people.size(), description, warnings));
        }

        if (entries.isEmpty()) {
            throw bad("That export has no expenses or payments in it.");
        }
        if (totals == null) {
            // Without it there is nothing to reconcile against, so the import can only be
            // checked for internal consistency. Worth saying out loud rather than assuming.
            warnings.add("This export has no closing 'Total balance' row, so the imported "
                    + "balances cannot be checked against Splitwise's own figures.");
            totals = List.of();
        }
        return new Parsed(people, currency == null ? "INR" : currency, entries, totals, warnings);
    }

    private static Entry entry(List<String> row, int count, String description,
                               List<String> warnings) {
        LocalDate date = date(at(row, 0).trim(), description);
        String category = at(row, 2).trim();
        BigDecimal cost = amount(at(row, 3).trim(), description);
        List<BigDecimal> nets = nets(row, count);

        BigDecimal netSum = nets.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        if (netSum.signum() != 0) {
            // Every row in a Splitwise export balances. One that does not means the file has
            // been edited, and importing it would put a made-up number in the ledger.
            throw bad("\"%s\" does not balance — its shares add up to %s rather than zero."
                    .formatted(description, netSum.toPlainString()));
        }
        if (cost.signum() <= 0) {
            throw bad("\"%s\" has a cost of %s.".formatted(description, cost.toPlainString()));
        }

        boolean payment = PAYMENT_CATEGORY.equalsIgnoreCase(category);
        if (payment) {
            return payment(date, description, category, cost, nets, warnings);
        }

        // Anybody negative paid nothing, so their share is the whole of what they are down.
        List<BigDecimal> owed = new ArrayList<>(nets.size());
        for (BigDecimal net : nets) {
            owed.add(net.signum() < 0 ? net.negate() : BigDecimal.ZERO);
        }

        List<Integer> payers = new ArrayList<>();
        for (int i = 0; i < nets.size(); i++) {
            if (nets.get(i).signum() > 0) payers.add(i);
        }

        BigDecimal remainder = cost.subtract(
                owed.stream().reduce(BigDecimal.ZERO, BigDecimal::add));
        boolean inferred = false;

        if (payers.isEmpty()) {
            // Everybody is square on a non-zero bill, which the nets cannot describe.
            throw bad("\"%s\" has nobody paying for it.".formatted(description));
        } else if (payers.size() == 1) {
            owed.set(payers.getFirst(), owed.get(payers.getFirst()).add(remainder));
        } else {
            inferred = true;
            spreadEvenly(remainder, payers, owed);
            warnings.add(("\"%s\" on %s was paid by %d people. Who owes what is exact; how much "
                    + "of it they each consumed is this importer's best guess.")
                    .formatted(description, date, payers.size()));
        }

        List<BigDecimal> paid = new ArrayList<>(nets.size());
        for (int i = 0; i < nets.size(); i++) {
            paid.add(two(nets.get(i).add(owed.get(i))));
        }
        owed.replaceAll(SplitwiseCsv::two);
        if (owed.stream().anyMatch(o -> o.signum() < 0) || paid.stream().anyMatch(p -> p.signum() < 0)) {
            throw bad("\"%s\" cannot be read as an expense — it implies a negative share."
                    .formatted(description));
        }
        return new Entry(date, description, category, cost, false, paid, owed, inferred);
    }

    /**
     * A settlement. One person hands money to exactly one other, so both halves are already in
     * the file and nothing has to be worked out.
     */
    private static Entry payment(LocalDate date, String description, String category,
                                 BigDecimal cost, List<BigDecimal> nets, List<String> warnings) {
        List<BigDecimal> paid = new ArrayList<>(nets.size());
        List<BigDecimal> owed = new ArrayList<>(nets.size());
        int from = -1;
        int to = -1;
        for (int i = 0; i < nets.size(); i++) {
            int sign = nets.get(i).signum();
            paid.add(two(sign > 0 ? nets.get(i) : BigDecimal.ZERO));
            owed.add(two(sign < 0 ? nets.get(i).negate() : BigDecimal.ZERO));
            if (sign > 0) from = i;
            if (sign < 0) to = i;
        }
        if (from < 0 || to < 0) {
            throw bad("\"%s\" is a payment with nobody on one side of it.".formatted(description));
        }
        if (paid.get(from).compareTo(cost) != 0) {
            // A payment moves one amount between two people; anything else is not one.
            warnings.add("\"%s\" on %s is recorded as a payment of %s but moves %s."
                    .formatted(description, date, cost.toPlainString(),
                            paid.get(from).toPlainString()));
        }
        return new Entry(date, description, category, cost, true, paid, owed, false);
    }

    /**
     * Divides the payers' own consumption between them, to the paisa.
     *
     * <p>Largest remainder, and the leftover goes to the earliest column so the same file always
     * imports identically — an importer that shuffles a paisa between runs would make the same
     * export reconcile one time and not the next.
     */
    private static void spreadEvenly(BigDecimal remainder, List<Integer> payers,
                                     List<BigDecimal> owed) {
        BigDecimal count = BigDecimal.valueOf(payers.size());
        BigDecimal each = remainder.divide(count, 2, java.math.RoundingMode.DOWN);
        BigDecimal spread = each.multiply(count);
        BigDecimal leftover = remainder.subtract(spread);

        for (int i = 0; i < payers.size(); i++) {
            BigDecimal share = each;
            // The leftover is whole paise, fewer than there are payers, handed out one each.
            if (leftover.signum() > 0 && i < leftover.movePointRight(2).intValueExact()) {
                share = share.add(new BigDecimal("0.01"));
            }
            int p = payers.get(i);
            owed.set(p, owed.get(p).add(share));
        }
    }

    /* ============================== reading ============================== */

    /**
     * Splits the text into rows and fields, RFC 4180 style.
     *
     * <p>Hand-rolled because the project has no CSV library and one import is a thin reason to
     * add a dependency — but it does handle quoting properly. A naive {@code split(",")} would
     * mangle any description with a comma in it, and "Dinner, drinks and a taxi" is exactly the
     * sort of thing people write.
     */
    static List<List<String>> readRows(String csv) {
        // A byte-order mark would otherwise end up inside the first header name.
        String text = csv.startsWith("﻿") ? csv.substring(1) : csv;

        List<List<String>> rows = new ArrayList<>();
        List<String> row = new ArrayList<>();
        StringBuilder field = new StringBuilder();
        boolean quoted = false;

        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);
            if (quoted) {
                if (c == '"') {
                    if (i + 1 < text.length() && text.charAt(i + 1) == '"') {
                        field.append('"');
                        i++;
                    } else {
                        quoted = false;
                    }
                } else {
                    field.append(c);
                }
                continue;
            }
            switch (c) {
                case '"' -> quoted = true;
                case ',' -> {
                    row.add(field.toString());
                    field.setLength(0);
                }
                case '\r' -> { /* handled by the \n that follows it */ }
                case '\n' -> {
                    row.add(field.toString());
                    field.setLength(0);
                    rows.add(row);
                    row = new ArrayList<>();
                }
                default -> field.append(c);
            }
        }
        if (field.length() > 0 || !row.isEmpty()) {
            row.add(field.toString());
            rows.add(row);
        }
        return rows;
    }

    private static List<BigDecimal> nets(List<String> row, int count) {
        List<BigDecimal> nets = new ArrayList<>(count);
        for (int i = 0; i < count; i++) {
            String cell = at(row, PEOPLE_COLUMN + i).trim();
            nets.add(cell.isEmpty() ? BigDecimal.ZERO : amount(cell, "a balance"));
        }
        return nets;
    }

    private static String at(List<String> row, int index) {
        return index < row.size() ? row.get(index) : "";
    }

    private static boolean isBlank(List<String> row) {
        return row.stream().allMatch(c -> c == null || c.isBlank());
    }

    private static LocalDate date(String text, String description) {
        try {
            return LocalDate.parse(text);
        } catch (DateTimeParseException e) {
            throw bad("\"%s\" has an unreadable date: %s".formatted(description, text));
        }
    }

    private static BigDecimal amount(String text, String what) {
        BigDecimal value;
        try {
            // Thousands separators are not in Splitwise's own output, but a file that has been
            // opened and re-saved in a spreadsheet can pick them up.
            value = new BigDecimal(text.replace(",", "").replace(" ", "").trim());
        } catch (NumberFormatException e) {
            throw bad("%s has an unreadable amount: %s".formatted(what, text));
        }
        if (value.scale() > 2) {
            // Same rule the allocator enforces: a column that holds paise cannot hold a third
            // decimal, and rounding somebody's money silently is not the alternative.
            throw bad("%s has an amount finer than a paisa: %s".formatted(what, text));
        }
        return two(value);
    }

    /**
     * Every amount at two decimals.
     *
     * <p>Scale is otherwise an accident of the arithmetic — {@code BigDecimal.ZERO} renders as
     * "0" while a computed zero renders as "0.00" — and these go straight out as JSON for a
     * preview somebody reads before committing an import.
     */
    private static BigDecimal two(BigDecimal value) {
        return value.setScale(2, java.math.RoundingMode.UNNECESSARY);
    }

    private static DbWorldException bad(String message) {
        return new DbWorldException(HttpStatus.BAD_REQUEST, message);
    }
}
