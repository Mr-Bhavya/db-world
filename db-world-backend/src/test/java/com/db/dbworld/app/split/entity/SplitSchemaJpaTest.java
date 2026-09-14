package com.db.dbworld.app.split.entity;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
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
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.assertThatCode;

/**
 * Guards the parts of the db-split schema that cannot be corrected after the first deploy.
 *
 * <p>This module ships under {@code ddl-auto: update}, and the {@code db/migration} folder was
 * deleted in {@code 7864dc8c}. {@code update} <b>adds</b> tables and columns on boot; it never
 * drops or alters an index or a constraint. So a unique key that ships with the wrong columns —
 * or a covering index that ships one column too narrow — stays wrong until somebody writes a
 * manual migration against production. This repo has already paid that bill once, for
 * {@code uk_media_request_record_kind}.
 *
 * <p>Hence assertions against {@code INFORMATION_SCHEMA} rather than a reading of the source.
 * The annotations and the emitted DDL are two different things, and only the second one matters:
 * an {@code @Index(columnList = ...)} naming a field instead of its physical column is accepted
 * by the compiler and produces a different index — or none.
 *
 * <p>Booting {@code @DataJpaTest} at all is half the value. It builds the
 * {@code EntityManagerFactory} from every mapping, and {@code hibernate.hbm2ddl.halt_on_error}
 * in {@code application-test.yml} turns any mapping that cannot produce DDL into a failure here
 * rather than a half-built schema in production.
 */
@DataJpaTest
@ActiveProfiles("test")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
// Imported explicitly rather than left to @TestConfiguration auto-detection: that scans the
// inner classes of the class being run, and for a @Nested class that is the nested one.
@Import(SplitSchemaJpaTest.CacheStubConfig.class)
@DisplayName("db-split schema")
class SplitSchemaJpaTest {

    /** {@code DbWorldApplication} is {@code @EnableCaching}; Boot 4's JPA slice supplies no manager. */
    @TestConfiguration
    static class CacheStubConfig {
        @Bean
        CacheManager cacheManager() {
            return new NoOpCacheManager();
        }
    }

    @Autowired
    private EntityManager em;

    /* ===================== the first-deploy-only guarantees ===================== */

    @Nested
    @DisplayName("unique constraints")
    class UniqueConstraints {

        @Test
        @DisplayName("member identity is unique per (group, user) so ghosts can share a NULL")
        void memberGroupUser() {
            assertThat(uniqueColumns("uk_split_group_member_group_user"))
                    .containsExactly("group_id", "user_id");
        }

        @Test
        @DisplayName("expense idempotency is scoped to the group, never global")
        void expenseIdempotency() {
            // Leading with group_id is the point: a globally unique token would let one user's
            // retry block an unrelated group's insert, and leak that the other group exists.
            assertThat(uniqueColumns("uk_split_expense_group_idem"))
                    .containsExactly("group_id", "idempotency_key");
        }

        @Test
        @DisplayName("settlement idempotency is scoped to the group")
        void settlementIdempotency() {
            assertThat(uniqueColumns("uk_split_settlement_group_idem"))
                    .containsExactly("group_id", "idempotency_key");
        }

        @Test
        @DisplayName("a payer and a beneficiary can each appear once per expense")
        void expenseChildrenAreDeduplicated() {
            // Without these a double-submit writes the rows twice and the expense reconciles to
            // twice its total, with every individual row still looking correct.
            assertThat(uniqueColumns("uk_split_expense_payer_expense_member"))
                    .containsExactly("expense_id", "member_id");
            assertThat(uniqueColumns("uk_split_expense_share_expense_beneficiary"))
                    .containsExactly("expense_id", "beneficiary_member_id");
        }
    }

    @Nested
    @DisplayName("indexes")
    class Indexes {

        @Test
        @DisplayName("the balance indexes carry amount last, making them covering")
        void ledgerBalanceIndexesAreCovering() {
            // The trailing amount is what lets a balance be summed from the index alone. It is
            // also the column ddl-auto can never add later: widening a 2-column index to 3 is an
            // ALTER, and update only ever issues CREATE.
            assertThat(indexColumns("idx_split_ledger_entry_group_to"))
                    .containsExactly("group_id", "to_member_id", "amount");
            assertThat(indexColumns("idx_split_ledger_entry_group_from"))
                    .containsExactly("group_id", "from_member_id", "amount");
        }

        @Test
        @DisplayName("voiding can find a source's ledger entries")
        void ledgerSourceLookup() {
            assertThat(indexColumns("idx_split_ledger_entry_source"))
                    .containsExactly("source_type", "source_id");
        }

        @Test
        @DisplayName("the expense feed seeks on status before the date")
        void expenseFeedIndex() {
            // status SECOND, inside the seek. This ordering is the whole reason status is an
            // enum column rather than a nullable voided_at, which could not give an equality
            // match in the middle of a composite.
            assertThat(indexColumns("idx_split_expense_group_date"))
                    .containsExactly("group_id", "status", "expense_date", "id");
        }

        @Test
        @DisplayName("'all groups I am in' has an index that leads with the user")
        void membershipByUser() {
            // Easy to miss, because uk_split_group_member_group_user looks like it covers this.
            // It leads with group_id, so it cannot: without the index below, the landing screen
            // scans every membership row in the system.
            assertThat(indexColumns("idx_split_group_member_user"))
                    .containsExactly("user_id", "group_id");
        }

        @Test
        @DisplayName("liability lookups and settlement history are indexed")
        void remainingReadPaths() {
            assertThat(indexColumns("idx_split_expense_share_owed"))
                    .containsExactly("owed_by_member_id");
            assertThat(indexColumns("idx_split_settlement_group_date"))
                    .containsExactly("group_id", "settled_at");
        }

        @Test
        @DisplayName("no member-only ledger index — the two balance indexes already serve it")
        void noRedundantLedgerIndex() {
            // Per-member balances resolve through the (group_id, member_id) prefix of the pair
            // above. A third index would only add write amplification to an append-only table.
            assertThat(indexNamesOn("split_ledger_entry"))
                    .containsExactlyInAnyOrder(
                            "idx_split_ledger_entry_group_to",
                            "idx_split_ledger_entry_group_from",
                            "idx_split_ledger_entry_source");
        }
    }

    /* ===================== the behaviour those constraints buy ===================== */

    @Nested
    @DisplayName("member identity")
    class MemberIdentity {

        @Test
        @DisplayName("any number of ghosts coexist in one group, because NULLs are distinct")
        void ghostsCoexist() {
            // The reason ghosts are expressible at all, and invisible from the annotation alone:
            // (group_id, NULL) may repeat under a unique key. If this ever fails, the feature
            // "add a family member who will never sign up" is gone.
            String groupId = persistGroup();
            persistMember(groupId, null, "Amma");
            persistMember(groupId, null, "Appa");
            persistMember(groupId, null, "Kid");

            assertThatCode(em::flush).doesNotThrowAnyException();
        }

        @Test
        @DisplayName("the same real user cannot join one group twice")
        void realUserIsUniquePerGroup() {
            String groupId = persistGroup();
            persistMember(groupId, 7L, "Bhavya");
            persistMember(groupId, 7L, "Bhavya again");

            assertThatThrownBy(em::flush).isInstanceOf(PersistenceException.class);
        }

        @Test
        @DisplayName("the same real user can be in two different groups")
        void realUserSpansGroups() {
            persistMember(persistGroup(), 7L, "Bhavya");
            persistMember(persistGroup(), 7L, "Bhavya");

            assertThatCode(em::flush).doesNotThrowAnyException();
        }
    }

    @Nested
    @DisplayName("money columns")
    class MoneyColumns {

        @Test
        @DisplayName("amounts are DECIMAL(12,2) and survive a round-trip unrounded")
        void amountsAreDecimal() {
            // Not a formality: a float column would store 0.10 as something that is not 0.10,
            // and the group-closure invariant would fail for reasons no amount of allocator
            // testing could explain.
            assertThat(columnType("split_expense", "total_amount")).isEqualTo("NUMERIC(12, 2)");
            assertThat(columnType("split_expense_share", "amount")).isEqualTo("NUMERIC(12, 2)");
            assertThat(columnType("split_ledger_entry", "amount")).isEqualTo("NUMERIC(12, 2)");
            assertThat(columnType("split_settlement", "amount")).isEqualTo("NUMERIC(12, 2)");

            String groupId = persistGroup();
            SplitExpenseEntity e = new SplitExpenseEntity();
            e.setGroupId(groupId);
            e.setDescription("Groceries");
            e.setTotalAmount(new BigDecimal("1234567890.10"));
            e.setExpenseDate(LocalDate.of(2026, 9, 14));
            e.setCreatedByUserId(7L);
            em.persist(e);
            em.flush();
            em.clear();

            assertThat(em.find(SplitExpenseEntity.class, e.getId()).getTotalAmount())
                    .isEqualByComparingTo("1234567890.10");
        }

        @Test
        @DisplayName("share weights keep four decimals, because percentages need them")
        void weightsKeepFourDecimals() {
            assertThat(columnType("split_expense_share", "share_percent")).isEqualTo("NUMERIC(12, 4)");
            assertThat(columnType("split_expense_share", "share_weight")).isEqualTo("NUMERIC(12, 4)");
        }
    }

    @Nested
    @DisplayName("nullability")
    class Nullability {

        @Test
        @DisplayName("owed_by_member_id is NOT NULL so balances never need COALESCE")
        void owedByIsMandatory() {
            // The hot path. A nullable column would mean reading
            // COALESCE(owed_by, beneficiary), which idx_split_expense_share_owed cannot serve.
            assertThat(isNullable("split_expense_share", "owed_by_member_id")).isFalse();
            assertThat(isNullable("split_expense_share", "beneficiary_member_id")).isFalse();
        }

        @Test
        @DisplayName("a member's user id and delegation target are both optional")
        void ghostAndDelegationAreOptional() {
            assertThat(isNullable("split_group_member", "user_id")).isTrue();
            assertThat(isNullable("split_group_member", "paid_for_by_member_id")).isTrue();
        }

        @Test
        @DisplayName("idempotency keys are nullable, which is what keeps them per-group distinct")
        void idempotencyKeysAreOptional() {
            assertThat(isNullable("split_expense", "idempotency_key")).isTrue();
            assertThat(isNullable("split_settlement", "idempotency_key")).isTrue();
        }
    }

    /* ============================== helpers ============================== */

    private String persistGroup() {
        SplitGroupEntity g = new SplitGroupEntity();
        g.setName("Home");
        g.setCreatedByUserId(7L);
        em.persist(g);
        return g.getId();
    }

    private void persistMember(String groupId, Long userId, String displayName) {
        SplitGroupMemberEntity m = new SplitGroupMemberEntity();
        m.setGroupId(groupId);
        m.setUserId(userId);
        m.setDisplayName(displayName);
        em.persist(m);
    }

    /** Columns of a named UNIQUE constraint, in key order. */
    @SuppressWarnings("unchecked")
    private List<String> uniqueColumns(String constraintName) {
        return ((List<Object>) em.createNativeQuery("""
                select kcu.column_name
                  from information_schema.key_column_usage kcu
                  join information_schema.table_constraints tc
                    on tc.constraint_name = kcu.constraint_name
                   and tc.constraint_schema = kcu.constraint_schema
                 where lower(kcu.constraint_name) = :name
                   and tc.constraint_type = 'UNIQUE'
                 order by kcu.ordinal_position
                """).setParameter("name", constraintName).getResultList())
                .stream().map(SplitSchemaJpaTest::lower).toList();
    }

    /** Columns of a named index, in index order. */
    @SuppressWarnings("unchecked")
    private List<String> indexColumns(String indexName) {
        return ((List<Object>) em.createNativeQuery("""
                select column_name from information_schema.index_columns
                 where lower(index_name) = :name
                 order by ordinal_position
                """).setParameter("name", indexName).getResultList())
                .stream().map(SplitSchemaJpaTest::lower).toList();
    }

    /** Every non-constraint index on a table — used to assert an index is *absent*. */
    @SuppressWarnings("unchecked")
    private List<String> indexNamesOn(String tableName) {
        return ((List<Object>) em.createNativeQuery("""
                select distinct index_name from information_schema.indexes
                 where lower(table_name) = :table
                   and index_type_name <> 'PRIMARY KEY'
                """).setParameter("table", tableName).getResultList())
                .stream().map(SplitSchemaJpaTest::lower).toList();
    }

    /**
     * A column's type rendered as {@code TYPE(precision, scale)}. Precision and scale are read
     * from their own columns rather than {@code data_type}, which reports a bare "numeric" and
     * would let a DECIMAL(12,0) pass a test meant to pin the paise.
     */
    private String columnType(String table, String column) {
        Object[] row = (Object[]) em.createNativeQuery("""
                select data_type, numeric_precision, numeric_scale
                  from information_schema.columns
                 where lower(table_name) = :table and lower(column_name) = :column
                """).setParameter("table", table).setParameter("column", column).getSingleResult();
        return "%s(%s, %s)".formatted(String.valueOf(row[0]).toUpperCase(Locale.ROOT), row[1], row[2]);
    }

    private boolean isNullable(String table, String column) {
        String nullable = (String) em.createNativeQuery("""
                select is_nullable from information_schema.columns
                 where lower(table_name) = :table and lower(column_name) = :column
                """).setParameter("table", table).setParameter("column", column).getSingleResult();
        return "YES".equalsIgnoreCase(nullable);
    }

    private static String lower(Object o) {
        return String.valueOf(o).toLowerCase(Locale.ROOT);
    }
}
