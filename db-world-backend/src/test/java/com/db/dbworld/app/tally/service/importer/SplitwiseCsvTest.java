package com.db.dbworld.app.tally.service.importer;

import com.db.dbworld.core.exception.DbWorldException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Reading a Splitwise export.
 *
 * <p>Every fixture here is a real row from a real four-person export, reproduced exactly — the
 * unequal splits and the multi-payer row included, because those are the two shapes that a
 * plausible-looking importer gets wrong. An import that divides everything equally passes a
 * test written against an equal split and quietly rewrites two years of history.
 */
@DisplayName("Splitwise CSV")
class SplitwiseCsvTest {

    /** The header and the four people, exactly as exported. */
    private static final String HEADER =
            "Date,Description,Category,Cost,Currency,"
            + "Jaykishan Dudhrejiya,Bhavya Dudhia,Rahul Gosai,rishi saini\n";

    private static final int JAY = 0;
    private static final int BHAVYA = 1;
    private static final int RAHUL = 2;
    private static final int RISHI = 3;

    private static SplitwiseCsv.Parsed parse(String... rows) {
        return SplitwiseCsv.parse(HEADER + "\n" + String.join("\n", rows) + "\n");
    }

    @Nested
    @DisplayName("the shape of the file")
    class Shape {

        @Test
        void readsThePeopleFromTheHeader() {
            var parsed = parse("2023-08-23,Train Tickets,Bus/train,8250.00,INR,"
                    + "6187.50,-2062.50,-2062.50,-2062.50");

            assertThat(parsed.people()).containsExactly(
                    "Jaykishan Dudhrejiya", "Bhavya Dudhia", "Rahul Gosai", "rishi saini");
            assertThat(parsed.currency()).isEqualTo("INR");
        }

        @Test
        @DisplayName("blank lines between sections are skipped, not read as rows")
        void blankLinesAreSkipped() {
            var parsed = SplitwiseCsv.parse(HEADER + "\n"
                    + "2023-08-23,Train Tickets,Bus/train,8250.00,INR,6187.50,-2062.50,-2062.50,-2062.50\n"
                    + "\n"
                    + "2023-09-30,Papad (cash),General,140.00,INR,105.00,-35.00,-35.00,-35.00\n"
                    + "\n\n");

            assertThat(parsed.entries()).hasSize(2);
        }

        @Test
        @DisplayName("the closing Total balance row is a target to reconcile against, not an event")
        void totalBalanceRowIsNotAnEntry() {
            var parsed = parse(
                    "2023-08-23,Train Tickets,Bus/train,8250.00,INR,6187.50,-2062.50,-2062.50,-2062.50",
                    "2026-09-15,Total balance, , ,INR,-150.00,0.00,0.00,150.00");

            assertThat(parsed.entries()).hasSize(1);
            assertThat(parsed.totals()).extracting(BigDecimal::toPlainString)
                    .containsExactly("-150.00", "0.00", "0.00", "150.00");
        }

        @Test
        @DisplayName("a description containing a comma survives, because the fields are quoted")
        void quotedFieldsAreHandled() {
            // Splitwise quotes these; a split(",") importer would shift every column right and
            // read somebody's share as the category.
            var parsed = parse("2023-09-30,\"Dinner, drinks and a taxi\",General,"
                    + "400.00,INR,300.00,-100.00,-100.00,-100.00");

            assertThat(parsed.entries().getFirst().description())
                    .isEqualTo("Dinner, drinks and a taxi");
            assertThat(parsed.entries().getFirst().cost()).isEqualByComparingTo("400.00");
        }

        @Test
        void aDoubledQuoteInsideAQuotedFieldIsOneQuote() {
            var parsed = parse("2023-09-30,\"The \"\"good\"\" hotel\",General,"
                    + "100.00,INR,50.00,-50.00,0.00,0.00");

            assertThat(parsed.entries().getFirst().description()).isEqualTo("The \"good\" hotel");
        }

        @Test
        void aByteOrderMarkDoesNotEndUpInTheFirstColumnName() {
            var parsed = SplitwiseCsv.parse("﻿" + HEADER
                    + "2023-09-30,Papad (cash),General,140.00,INR,105.00,-35.00,-35.00,-35.00\n");

            assertThat(parsed.people()).hasSize(4);
        }
    }

    @Nested
    @DisplayName("expenses — recovering who paid and who owed from a net")
    class Expenses {

        @Test
        @DisplayName("an equal split with one payer comes back exactly")
        void singlePayerEqualSplit() {
            // Jaykishan put 8250 on his card; four ways is 2062.50 each, so his net is +6187.50.
            var entry = parse("2023-08-23,Train Tickets,Bus/train,8250.00,INR,"
                    + "6187.50,-2062.50,-2062.50,-2062.50").entries().getFirst();

            assertThat(entry.payment()).isFalse();
            assertThat(entry.payerInferred()).isFalse();
            assertThat(entry.paid()).extracting(BigDecimal::toPlainString)
                    .containsExactly("8250.00", "0.00", "0.00", "0.00");
            assertThat(entry.owed()).extracting(BigDecimal::toPlainString)
                    .containsExactly("2062.50", "2062.50", "2062.50", "2062.50");
        }

        @Test
        @DisplayName("an UNEQUAL split comes back exactly too — this is why it imports amounts")
        void singlePayerUnequalSplit() {
            // City palace: 900, but the shares were 150/150/300/300, not 225 each. An importer
            // that divided equally would put four wrong numbers in the ledger and still
            // reconcile, because the balances would come out the same.
            var entry = parse("2023-09-30,City palace,General,900.00,INR,"
                    + "750.00,-150.00,-300.00,-300.00").entries().getFirst();

            assertThat(entry.paid().get(JAY)).isEqualByComparingTo("900.00");
            assertThat(entry.owed()).extracting(BigDecimal::toPlainString)
                    .containsExactly("150.00", "150.00", "300.00", "300.00");
            assertThat(entry.payerInferred()).isFalse();
        }

        @Test
        @DisplayName("the payer is not always the biggest consumer, or a consumer at all")
        void aPayerWhoAteNothing() {
            // Chai: Jaykishan paid all 20 and owed none of it.
            var entry = parse("2023-10-02,Chai at patrika gate,Dining out,20.00,INR,"
                    + "20.00,-10.00,0.00,-10.00").entries().getFirst();

            assertThat(entry.paid().get(JAY)).isEqualByComparingTo("20.00");
            assertThat(entry.owed().get(JAY)).isEqualByComparingTo("0.00");
            assertThat(entry.owed().get(BHAVYA)).isEqualByComparingTo("10.00");
            assertThat(entry.owed().get(RAHUL)).isEqualByComparingTo("0.00");
        }

        @Test
        @DisplayName("somebody who was not in an expense stays out of it")
        void aZeroNetIsNotAParticipant() {
            var entry = parse("2023-10-02,Soda at patrika gate,Groceries,80.00,INR,"
                    + "40.00,0.00,-40.00,0.00").entries().getFirst();

            assertThat(entry.owed().get(BHAVYA)).isEqualByComparingTo("0");
            assertThat(entry.paid().get(BHAVYA)).isEqualByComparingTo("0");
            assertThat(entry.owed().get(RISHI)).isEqualByComparingTo("0");
        }

        @Test
        @DisplayName("several payers is the one case that cannot be recovered, and says so")
        void multiplePayersIsFlagged() {
            // Three positive nets. Whatever the payers themselves consumed has to be divided
            // somehow, and the file does not say how.
            var parsed = parse("2023-10-19,Cash Given to random person,General,600.00,INR,"
                    + "-450.00,150.00,150.00,150.00");
            var entry = parsed.entries().getFirst();

            assertThat(entry.payerInferred()).isTrue();
            assertThat(parsed.warnings()).anySatisfy(w ->
                    assertThat(w).contains("Cash Given to random person").contains("best guess"));

            // What is NOT a guess: the totals still close, so nobody's balance moves by a paisa
            // more or less than Splitwise said it did.
            assertThat(sum(entry.paid())).isEqualByComparingTo("600.00");
            assertThat(sum(entry.owed())).isEqualByComparingTo("600.00");
            for (int i = 0; i < 4; i++) {
                assertThat(entry.paid().get(i).subtract(entry.owed().get(i)))
                        .as("net for column %d is preserved", i)
                        .isEqualByComparingTo(List.of(
                                new BigDecimal("-450.00"), new BigDecimal("150.00"),
                                new BigDecimal("150.00"), new BigDecimal("150.00")).get(i));
            }
        }

        @Test
        @DisplayName("the inferred division is to the paisa, and the same on every run")
        void inferredDivisionLosesNothing() {
            // Two payers of 50 each on a 100 bill split three ways: 33.34 / 33.33 / 33.33. The
            // remainder to divide is 66.67, which does not halve, so a paisa has to land
            // somewhere -- and always on the same side, or the same file would import two ways.
            var entry = parse("2023-10-19,Odd one,General,100.00,INR,"
                    + "0.00,16.66,16.67,-33.33").entries().getFirst();

            assertThat(entry.payerInferred()).isTrue();
            assertThat(sum(entry.owed())).isEqualByComparingTo("100.00");
            assertThat(sum(entry.paid())).isEqualByComparingTo("100.00");
            assertThat(entry.owed()).extracting(BigDecimal::toPlainString)
                    .containsExactly("0.00", "33.34", "33.33", "33.33");
            // And here the guess happens to land on the truth: they really did pay 50 each.
            assertThat(entry.paid()).extracting(BigDecimal::toPlainString)
                    .containsExactly("0.00", "50.00", "50.00", "0.00");
        }
    }

    @Nested
    @DisplayName("payments")
    class Payments {

        @Test
        @DisplayName("a payment names both sides, so nothing has to be worked out")
        void aPaymentIsUnambiguous() {
            var entry = parse("2023-08-24,rishi s. paid Jaykishan D.,Payment,2062.50,INR,"
                    + "-2062.50,0.00,0.00,2062.50").entries().getFirst();

            assertThat(entry.payment()).isTrue();
            assertThat(entry.payerIndex()).as("rishi handed the money over").isEqualTo(RISHI);
            assertThat(entry.payeeIndex()).as("Jaykishan received it").isEqualTo(JAY);
            assertThat(entry.cost()).isEqualByComparingTo("2062.50");
        }

        @Test
        void paymentsAreToldApartFromExpensesByCategory() {
            var parsed = parse(
                    "2023-08-23,Train Tickets,Bus/train,8250.00,INR,6187.50,-2062.50,-2062.50,-2062.50",
                    "2023-08-24,rishi s. paid Jaykishan D.,Payment,2062.50,INR,-2062.50,0.00,0.00,2062.50");

            assertThat(parsed.entries()).extracting(SplitwiseCsv.Entry::payment)
                    .containsExactly(false, true);
        }

        @Test
        @DisplayName("an expense that only reads like a settlement stays an expense")
        void settleAllBalancesIsStillAnExpense() {
            // Real row: described as settling up but filed under General, so Splitwise counted
            // it as an expense and so must this, or the balances will not match.
            var entry = parse("2024-02-18,Settle all balances,General,150.00,INR,"
                    + "150.00,-150.00,0.00,0.00").entries().getFirst();

            assertThat(entry.payment()).isFalse();
            assertThat(entry.owed().get(BHAVYA)).isEqualByComparingTo("150.00");
        }
    }

    @Nested
    @DisplayName("files it should refuse")
    class Refusals {

        @Test
        void anEmptyFile() {
            assertThatThrownBy(() -> SplitwiseCsv.parse(""))
                    .isInstanceOf(DbWorldException.class)
                    .hasMessageContaining("empty");
        }

        @Test
        void somethingThatIsNotASplitwiseExport() {
            assertThatThrownBy(() -> SplitwiseCsv.parse("name,email\nSomebody,a@b.c\n"))
                    .isInstanceOf(DbWorldException.class)
                    .hasMessageContaining("does not look like a Splitwise export");
        }

        @Test
        @DisplayName("a row whose shares do not add up — the file has been edited")
        void aRowThatDoesNotBalance() {
            assertThatThrownBy(() -> parse("2023-08-23,Train Tickets,Bus/train,8250.00,INR,"
                    + "6187.50,-2062.50,-2062.50,-2000.00"))
                    .isInstanceOf(DbWorldException.class)
                    .hasMessageContaining("does not balance");
        }

        @Test
        @DisplayName("two currencies, because a single total over both would be meaningless")
        void mixedCurrencies() {
            assertThatThrownBy(() -> parse(
                    "2023-08-23,Train,Bus/train,8250.00,INR,6187.50,-2062.50,-2062.50,-2062.50",
                    "2023-08-24,Hotel,General,100.00,USD,75.00,-25.00,0.00,-50.00"))
                    .isInstanceOf(DbWorldException.class)
                    .hasMessageContaining("mixes");
        }

        @Test
        void anUnreadableDate() {
            assertThatThrownBy(() -> parse("23/08/2023,Train,Bus/train,8250.00,INR,"
                    + "6187.50,-2062.50,-2062.50,-2062.50"))
                    .isInstanceOf(DbWorldException.class)
                    .hasMessageContaining("unreadable date");
        }

        @Test
        void aFileWithAHeaderAndNothingElse() {
            assertThatThrownBy(() -> SplitwiseCsv.parse(HEADER))
                    .isInstanceOf(DbWorldException.class)
                    .hasMessageContaining("no expenses or payments");
        }
    }

    @Nested
    @DisplayName("the whole export, end to end")
    class WholeFile {

        @Test
        @DisplayName("every row reconciles against the file's own closing balances")
        void reconcilesAgainstTheStatedTotals() {
            var parsed = SplitwiseCsv.parse(WHOLE_EXPORT);

            assertThat(parsed.entries()).hasSize(25);
            assertThat(parsed.entries()).filteredOn(SplitwiseCsv.Entry::payment).hasSize(9);
            assertThat(parsed.entries()).filteredOn(SplitwiseCsv.Entry::payerInferred).hasSize(1);

            // The one assertion that matters: reconstructing paid and owed from the nets moves
            // every person by exactly what Splitwise says they ended up at.
            for (int i = 0; i < parsed.people().size(); i++) {
                final int person = i;
                BigDecimal net = parsed.entries().stream()
                        .map(e -> e.paid().get(person).subtract(e.owed().get(person)))
                        .reduce(BigDecimal.ZERO, BigDecimal::add);
                assertThat(net).as("closing balance for %s", parsed.people().get(i))
                        .isEqualByComparingTo(parsed.totals().get(i));
            }
        }

        @Test
        void everyRowKeepsItsOwnCostIntact() {
            var parsed = SplitwiseCsv.parse(WHOLE_EXPORT);

            assertThat(parsed.entries()).allSatisfy(entry -> {
                if (!entry.payment()) {
                    assertThat(sum(entry.paid())).as("paid on %s", entry.description())
                            .isEqualByComparingTo(entry.cost());
                    assertThat(sum(entry.owed())).as("owed on %s", entry.description())
                            .isEqualByComparingTo(entry.cost());
                }
            });
        }

        @Test
        void theDatesSpanTheWholeTrip() {
            var parsed = SplitwiseCsv.parse(WHOLE_EXPORT);

            assertThat(parsed.entries().getFirst().date()).isEqualTo(LocalDate.of(2023, 8, 23));
            assertThat(parsed.entries().getLast().date()).isEqualTo(LocalDate.of(2024, 2, 18));
        }
    }

    private static BigDecimal sum(List<BigDecimal> values) {
        return values.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    /** The real export, verbatim. */
    private static final String WHOLE_EXPORT = """
            Date,Description,Category,Cost,Currency,Jaykishan Dudhrejiya,Bhavya Dudhia,Rahul Gosai,rishi saini

            2023-08-23,Train Tickets,Bus/train,8250.00,INR,6187.50,-2062.50,-2062.50,-2062.50
            2023-08-24,rishi s. paid Jaykishan D.,Payment,2062.50,INR,-2062.50,0.00,0.00,2062.50
            2023-09-26,Rahul G. paid Jaykishan D.,Payment,2062.50,INR,-2062.50,0.00,2062.50,0.00
            2023-09-30,Udaipur railway station,General,160.00,INR,-40.00,120.00,-40.00,-40.00
            2023-09-30,Boby mansion (online),General,5550.00,INR,4162.50,-1387.50,-1387.50,-1387.50
            2023-09-30,Laxmi Mishthan Bhandar (cash),General,430.00,INR,322.50,-107.50,-107.50,-107.50
            2023-09-30,Auto to LMB (cash),Car,50.00,INR,37.50,-12.50,-12.50,-12.50
            2023-09-30,Papad (cash),General,140.00,INR,105.00,-35.00,-35.00,-35.00
            2023-09-30,City palace,General,900.00,INR,750.00,-150.00,-300.00,-300.00
            2023-09-30,Jantar Mantar (online),Dining out,118.00,INR,-22.00,-22.00,-52.00,96.00
            2023-09-30,Tea at city palace,Dining out,60.00,INR,40.00,-20.00,0.00,-20.00
            2023-09-30,Auto to birla mandir,Car,100.00,INR,75.00,-25.00,-25.00,-25.00
            2023-09-30,Auto to ppali,Car,60.00,INR,45.00,-15.00,-15.00,-15.00
            2023-09-30,Back to boby mansion,General,130.00,INR,97.50,-32.50,-32.50,-32.50
            2023-10-02,Soda at patrika gate,Groceries,80.00,INR,40.00,0.00,-40.00,0.00
            2023-10-02,Chai at patrika gate,Dining out,20.00,INR,20.00,-10.00,0.00,-10.00
            2023-10-02,Bhavya D. paid Jaykishan D.,Payment,3817.50,INR,-3817.50,3817.50,0.00,0.00
            2023-10-02,Rahul G. paid Bhavya D.,Payment,40.00,INR,0.00,-40.00,40.00,0.00
            2023-10-02,Rahul G. paid rishi s.,Payment,52.00,INR,0.00,0.00,52.00,-52.00
            2023-10-02,Rahul G. paid Jaykishan D.,Payment,1955.00,INR,-1955.00,0.00,1955.00,0.00
            2023-10-02,rishi s. paid Bhavya D.,Payment,18.00,INR,0.00,-18.00,0.00,18.00
            2023-10-02,rishi s. paid Jaykishan D.,Payment,1923.00,INR,-1923.00,0.00,0.00,1923.00
            2023-10-19,Cash Given to random person,General,600.00,INR,-450.00,150.00,150.00,150.00
            2023-12-09,Jaykishan D. paid Rahul G.,Payment,150.00,INR,150.00,0.00,-150.00,0.00
            2024-02-18,Settle all balances,General,150.00,INR,150.00,-150.00,0.00,0.00

            2026-09-15,Total balance, , ,INR,-150.00,0.00,0.00,150.00
            """;
}
