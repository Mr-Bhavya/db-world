package com.db.dbworld.app.tally.service.importer;

import com.db.dbworld.app.tally.dto.SplitwiseImportRequest;
import com.db.dbworld.app.tally.dto.SplitwiseImportRequest.PersonMapping;
import com.db.dbworld.app.tally.dto.TallyExpenseDto;
import com.db.dbworld.app.tally.dto.TallyMemberDto;
import com.db.dbworld.app.tally.mapper.TallyMapperImpl;
import com.db.dbworld.app.tally.service.TallyAccessService;
import com.db.dbworld.app.tally.service.TallyActivityService;
import com.db.dbworld.app.tally.service.TallyBalanceService;
import com.db.dbworld.app.tally.service.TallyExpenseService;
import com.db.dbworld.app.tally.service.TallyGroupService;
import com.db.dbworld.app.tally.service.TallyLedgerService;
import com.db.dbworld.app.tally.service.TallyMemberService;
import com.db.dbworld.app.tally.service.TallySettlementService;
import com.db.dbworld.core.exception.DbWorldException;
import com.db.dbworld.core.role.entity.RoleEntity;
import com.db.dbworld.core.role.enums.Role;
import com.db.dbworld.core.user.entity.UserEntity;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.cache.CacheManager;
import org.springframework.cache.support.NoOpCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Importing a real Splitwise export, end to end.
 *
 * <p>The fixture is an actual four-person export covering two trips and eighteen months: sixteen
 * expenses, nine payments, two unequal splits and one row paid by three people at once. It is
 * used verbatim, because the point of this test is that a genuine file lands correctly, not that
 * a file shaped the way I imagined does.
 *
 * <p>Everything else here is secondary to one assertion: after the import, every member's
 * balance equals the closing figure the export itself states. That check is what makes importing
 * into an append-only ledger defensible.
 */
@DataJpaTest
@ActiveProfiles("test")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import({TallyAccessService.class, TallyLedgerService.class, TallyExpenseService.class,
         TallyBalanceService.class, TallyGroupService.class, TallyMemberService.class,
         TallySettlementService.class, TallyActivityService.class, TallyImportService.class,
         TallyImportTest.CacheStubConfig.class, TallyMapperImpl.class})
@DisplayName("Splitwise import")
class TallyImportTest {

    @TestConfiguration
    static class CacheStubConfig {
        @Bean
        CacheManager cacheManager() {
            return new NoOpCacheManager();
        }
    }

    private static final String JAY = "Jaykishan Dudhrejiya";
    private static final String BHAVYA = "Bhavya Dudhia";
    private static final String RAHUL = "Rahul Gosai";
    private static final String RISHI = "rishi saini";

    @Autowired private EntityManager em;
    @Autowired private TallyImportService imports;
    @Autowired private TallyGroupService groups;
    @Autowired private TallyExpenseService expenses;
    @Autowired private TallyBalanceService balances;

    private Long me;

    @BeforeEach
    void setUp() {
        RoleEntity role = new RoleEntity();
        role.setName(Role.VIEWER);
        em.persist(role);

        UserEntity user = new UserEntity();
        user.setFirstName("Bhavya");
        user.setEmail("bhavya@example.test");
        user.setRole(role);
        em.persist(user);
        em.flush();
        me = user.getUserId();
    }

    /* ============================== preview ============================== */

    @Test
    @DisplayName("the preview reads the file and writes nothing")
    void previewWritesNothing() {
        var preview = imports.preview(EXPORT);

        assertThat(preview.expenseCount()).isEqualTo(16);
        assertThat(preview.paymentCount()).isEqualTo(9);
        assertThat(preview.inferredRows()).isEqualTo(1);
        assertThat(preview.currency()).isEqualTo("INR");
        assertThat(preview.reconcilable()).isTrue();
        assertThat(preview.people()).extracting(p -> p.name())
                .containsExactly(JAY, BHAVYA, RAHUL, RISHI);
        assertThat(preview.firstDate().toString()).isEqualTo("2023-08-23");
        assertThat(preview.lastDate().toString()).isEqualTo("2024-02-18");

        // Nothing has been created by looking.
        assertThat(groups.listMine(me)).isEmpty();
    }

    @Test
    @DisplayName("the preview totals what each person paid and used, and the closing balances")
    void previewTotals() {
        var preview = imports.preview(EXPORT);

        var jay = preview.people().getFirst();
        assertThat(jay.closingBalance()).isEqualByComparingTo("-150.00");
        // The payments are deliberately not in these: handing money over is not spending it.
        assertThat(preview.totalSpend()).isEqualByComparingTo("16798.00");
        assertThat(preview.people()).extracting(p -> p.closingBalance())
                .extracting(BigDecimal::toPlainString)
                .containsExactly("-150.00", "0.00", "0.00", "150.00");
    }

    /* ============================== the import ============================== */

    @Test
    @DisplayName("every balance matches the figure the export itself states")
    void reconcilesExactly() {
        var result = imports.importGroup(me, request());

        assertThat(result.expensesCreated()).isEqualTo(16);
        assertThat(result.settlementsCreated()).isEqualTo(9);
        assertThat(result.reconciled()).isTrue();

        var roster = groups.get(me, result.group().id()).members();
        assertThat(roster).hasSize(4);

        assertThat(balanceOf(result.group().id(), roster, "Jaykishan Dudhrejiya"))
                .isEqualByComparingTo("-150.00");
        assertThat(balanceOf(result.group().id(), roster, "Bhavya"))
                .isEqualByComparingTo("0.00");
        assertThat(balanceOf(result.group().id(), roster, RAHUL))
                .isEqualByComparingTo("0.00");
        assertThat(balanceOf(result.group().id(), roster, RISHI))
                .isEqualByComparingTo("150.00");
    }

    @Test
    @DisplayName("an UNEQUAL split arrives unequal, not averaged")
    void unequalSplitsSurvive() {
        var result = imports.importGroup(me, request());

        // City palace: 900, shares 150/150/300/300. An importer that divided equally would put
        // 225 on each and still reconcile, because the balances would come out identical.
        var cityPalace = expenseNamed(result.group().id(), "City palace");
        assertThat(cityPalace.totalAmount()).isEqualByComparingTo("900.00");
        assertThat(cityPalace.shares()).extracting(s -> s.amount())
                .extracting(BigDecimal::toPlainString)
                .containsExactlyInAnyOrder("150.00", "150.00", "300.00", "300.00");
    }

    @Test
    @DisplayName("a payer who ate none of it owes none of it")
    void aPayerCanOweNothing() {
        var result = imports.importGroup(me, request());

        // Chai: Jaykishan paid all 20 and was not one of the two people drinking it.
        var chai = expenseNamed(result.group().id(), "Chai at patrika gate");
        assertThat(chai.payers()).singleElement()
                .satisfies(p -> assertThat(p.amount()).isEqualByComparingTo("20.00"));
        assertThat(chai.shares()).hasSize(2);
        assertThat(chai.shares()).allSatisfy(s ->
                assertThat(s.amount()).isEqualByComparingTo("10.00"));
    }

    @Test
    @DisplayName("the one row that had to be guessed says so on the expense")
    void theInferredRowIsLabelled() {
        var result = imports.importGroup(me, request());

        var guessed = expenseNamed(result.group().id(), "Cash Given to random person");
        assertThat(guessed.notes()).contains("Several people paid").contains("estimate");
        assertThat(result.inferredRows()).isEqualTo(1);

        // Still exact where it counts -- the bill and everyone's liability.
        assertThat(guessed.totalAmount()).isEqualByComparingTo("600.00");
    }

    @Test
    @DisplayName("Splitwise's own category survives, except its catch-all")
    void categoriesAreKeptButGeneralIsNot() {
        var result = imports.importGroup(me, request());

        assertThat(expenseNamed(result.group().id(), "Train Tickets").category())
                .isEqualTo("Bus/train");
        // "General" means "uncategorised" over there, so carrying it across would invent a
        // category that every third expense belongs to.
        assertThat(expenseNamed(result.group().id(), "Papad (cash)").category()).isNull();
    }

    @Test
    @DisplayName("somebody without an account comes in as a ghost, under their own name")
    void peopleWithoutAccountsBecomeGhosts() {
        var result = imports.importGroup(me, request());
        var roster = groups.get(me, result.group().id()).members();

        assertThat(roster).filteredOn(m -> RISHI.equals(m.displayName()))
                .singleElement()
                .satisfies(m -> assertThat(m.userId()).as("a ghost has no account").isNull());
        assertThat(roster).filteredOn(m -> m.userId() != null)
                .singleElement()
                .satisfies(m -> assertThat(m.userId()).isEqualTo(me));
    }

    /* ============================== refusals ============================== */

    @Test
    @DisplayName("a column nobody was chosen for is refused before anything is written")
    void everyColumnMustBeMatched() {
        var partial = new SplitwiseImportRequest(EXPORT, "Jaipur", "Trip", null,
                List.of(new PersonMapping(JAY, null, null),
                        new PersonMapping(BHAVYA, me, "Bhavya")));

        assertThatThrownBy(() -> imports.importGroup(me, partial))
                .isInstanceOf(DbWorldException.class)
                .hasMessageContaining("Nobody was chosen for")
                .hasMessageContaining(RAHUL);
    }

    @Test
    @DisplayName("two columns cannot be the same account")
    void oneAccountCannotBeTwoPeople() {
        var doubled = new SplitwiseImportRequest(EXPORT, "Jaipur", "Trip", null,
                List.of(new PersonMapping(JAY, me, null),
                        new PersonMapping(BHAVYA, me, "Bhavya"),
                        new PersonMapping(RAHUL, null, null),
                        new PersonMapping(RISHI, null, null)));

        assertThatThrownBy(() -> imports.importGroup(me, doubled))
                .isInstanceOf(DbWorldException.class)
                .hasMessageContaining("cannot both be the same person");
    }

    @Test
    @DisplayName("a name that is not in the file is refused rather than ignored")
    void anUnknownColumnIsRefused() {
        var strange = new SplitwiseImportRequest(EXPORT, "Jaipur", "Trip", null,
                List.of(new PersonMapping(JAY, null, null),
                        new PersonMapping(BHAVYA, me, "Bhavya"),
                        new PersonMapping(RAHUL, null, null),
                        new PersonMapping(RISHI, null, null),
                        new PersonMapping("Somebody Else", null, null)));

        assertThatThrownBy(() -> imports.importGroup(me, strange))
                .isInstanceOf(DbWorldException.class)
                .hasMessageContaining("not a column in that export");
    }

    @Test
    @DisplayName("a file whose closing balances do not match what it contains is refused")
    void aTamperedTotalIsCaught() {
        // The rows still balance individually, so only the reconciliation can catch this. It is
        // the guard that stops a subtly wrong import becoming permanent.
        String tampered = EXPORT.replace(
                "2026-09-15,Total balance, , ,INR,-150.00,0.00,0.00,150.00",
                "2026-09-15,Total balance, , ,INR,-250.00,0.00,0.00,250.00");

        var request = new SplitwiseImportRequest(tampered, "Jaipur", "Trip", null, mappings());

        assertThatThrownBy(() -> imports.importGroup(me, request))
                .isInstanceOf(DbWorldException.class)
                .hasMessageContaining("did not add up")
                .hasMessageContaining("nothing was saved");
    }


    /* ============================== fixtures ============================== */

    private SplitwiseImportRequest request() {
        return new SplitwiseImportRequest(EXPORT, "Jaipur trip", "Trip", null, mappings());
    }

    /** Me as myself, the other three as ghosts — the ordinary case. */
    private List<PersonMapping> mappings() {
        return List.of(
                new PersonMapping(JAY, null, "Jaykishan Dudhrejiya"),
                new PersonMapping(BHAVYA, me, "Bhavya"),
                new PersonMapping(RAHUL, null, null),
                new PersonMapping(RISHI, null, null));
    }

    private BigDecimal balanceOf(String groupId, List<TallyMemberDto> roster, String name) {
        return balances.netOf(groupId, roster.stream()
                .filter(m -> name.equals(m.displayName()))
                .findFirst().orElseThrow(() -> new AssertionError("no member called " + name))
                .id());
    }

    private TallyExpenseDto expenseNamed(String groupId, String description) {
        return expenses.list(me, groupId, null, null, 100).items().stream()
                .filter(e -> description.equals(e.description()))
                .findFirst().orElseThrow(() -> new AssertionError("no expense called " + description));
    }

    /** The real export, verbatim. */
    private static final String EXPORT = """
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
