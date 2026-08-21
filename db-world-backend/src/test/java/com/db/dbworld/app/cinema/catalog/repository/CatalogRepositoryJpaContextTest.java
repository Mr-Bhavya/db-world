package com.db.dbworld.app.cinema.catalog.repository;

import com.db.dbworld.app.cinema.catalog.entities.RecordEntity;
import com.db.dbworld.app.cinema.catalog.entities.RecordTagEntity;
import com.db.dbworld.app.cinema.catalog.tags.entity.TagDefinitionEntity;
import com.db.dbworld.app.cinema.catalog.tags.entity.TagDefinitionRepository;
import com.db.dbworld.app.cinema.enums.RecordType;
import com.db.dbworld.app.cinema.enums.RecordVisibility;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.cache.CacheManager;
import org.springframework.cache.support.NoOpCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The project's JPA smoke test.
 *
 * <p>Its real job is the {@code @DataJpaTest} annotation itself. Booting the JPA slice forces
 * Hibernate to build the {@code EntityManagerFactory} from every {@code @Entity} class, and — since
 * {@code DbWorldApplication} carries an explicit {@code @EnableJpaRepositories} — forces Spring Data
 * to instantiate every repository bean in {@code com.db.dbworld}. Spring Data parses and validates
 * each {@code @Query} JPQL string at repository-bean creation, and Hibernate generates DDL for every
 * mapping at that same moment. A typo'd JPQL alias, a renamed entity field, or a mapping that can no
 * longer produce a column therefore fails HERE, at build time, instead of on the first request in
 * production. The assertions below are almost incidental by comparison.
 *
 * <p>Runs against in-memory H2 (see {@code src/test/resources/application-test.yml}); production is
 * MySQL. Two pieces of wiring are load-bearing and easy to break:
 * <ul>
 *   <li>{@code replace = NONE} — without it Spring Boot swaps in its own auto-built embedded
 *       DataSource and discards the configured H2 URL, whose {@code INIT=CREATE SCHEMA} clause is
 *       what makes the entities' {@code @Table(schema = "db_world")} resolvable.</li>
 *   <li>{@link CacheStubConfig} — {@code DbWorldApplication} is annotated {@code @EnableCaching},
 *       and Spring Boot 4's JPA slice no longer imports the cache auto-configuration, so the context
 *       fails with "no qualifying bean of type CacheManager" unless one is supplied.</li>
 * </ul>
 *
 * <p>Native queries ({@code nativeQuery = true}, plus the hand-built SQL in
 * {@code RecordRepositoryImpl}) are deliberately NOT covered — those are parsed by the database
 * rather than by Hibernate, and several use MySQL-only constructs ({@code GROUP_CONCAT ... SEPARATOR},
 * unqualified table names). They can only be validated against a real MySQL.
 */
@DataJpaTest
@ActiveProfiles("test")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@DisplayName("Cinema catalog JPA context")
class CatalogRepositoryJpaContextTest {

    /**
     * Satisfies {@code @EnableCaching} on {@code DbWorldApplication}. A no-op manager is the honest
     * choice here: caching behaviour is not what this test is about, and the real one is Redis-backed.
     */
    @TestConfiguration
    static class CacheStubConfig {
        @Bean
        CacheManager cacheManager() {
            return new NoOpCacheManager();
        }
    }

    @Autowired
    private RecordRepository recordRepository;

    @Autowired
    private RecordTagRepository recordTagRepository;

    @Autowired
    private TagDefinitionRepository tagDefinitionRepository;

    @Autowired
    private EntityManager entityManager;

    @Test
    @DisplayName("boots and exposes the tag-related repositories as beans")
    void repositoriesAreInjectable() {
        // Reaching this line at all means the EntityManagerFactory built and every
        // repository bean in com.db.dbworld was created and its JPQL validated.
        assertThat(recordRepository).isNotNull();
        assertThat(recordTagRepository).isNotNull();
        assertThat(tagDefinitionRepository).isNotNull();
        assertThat(entityManager.getEntityManagerFactory().getMetamodel().getEntities())
                .as("Hibernate should have mapped the whole entity model, not a subset")
                .hasSizeGreaterThan(50);
    }

    @Test
    @DisplayName("round-trips a record with a tag and counts it by tag type")
    void recordWithTagRoundTrips() {
        var record = persistRecord("The Fellowship of the Ring", RecordType.MOVIE);
        persistTag(record, "TRENDING", 10);

        flushAndClear();

        assertThat(recordTagRepository.countByTagType("TRENDING")).isEqualTo(1L);
        assertThat(recordTagRepository.countByTagType("TOP_10")).isZero();

        Optional<RecordEntity> reloaded = recordRepository.findById(record.getId());
        assertThat(reloaded).isPresent();
        assertThat(reloaded.orElseThrow().getTags())
                .extracting(RecordTagEntity::getTagType)
                .containsExactly("TRENDING");
    }

    /**
     * Executes two of {@link RecordRepository}'s hand-written JPQL rail queries end to end.
     * Deliberately picks the variants that do NOT {@code JOIN r.tmdb} — the tmdb-joining ones would
     * silently return nothing here, and a TMDB row isn't needed to prove the JPQL parses and the
     * join to {@code r.tags} resolves.
     */
    @Test
    @DisplayName("executes the tag-rail JPQL, ordered by tag priority")
    void tagRailQueryReturnsIdsOrderedByPriority() {
        var low = persistRecord("Low priority", RecordType.MOVIE);
        var high = persistRecord("High priority", RecordType.TV_SERIES);
        var untagged = persistRecord("Untagged", RecordType.MOVIE);

        persistTag(low, "TRENDING", 1);
        persistTag(high, "TRENDING", 99);

        flushAndClear();

        Pageable page = PageRequest.of(0, 10);

        Slice<Long> byPriority =
                recordRepository.findIdsByTagOrderByPriorityDesc("TRENDING", page);
        assertThat(byPriority.getContent())
                .containsExactly(high.getId(), low.getId())
                .doesNotContain(untagged.getId());

        Slice<Long> multiTag =
                recordRepository.findIdsByTags(List.of("TRENDING", "TOP_10"), page);
        assertThat(multiTag.getContent())
                .containsExactlyInAnyOrder(low.getId(), high.getId());

        // Derived queries on the record itself.
        assertThat(recordRepository.countByType(RecordType.TV_SERIES)).isEqualTo(1L);
        assertThat(recordRepository.findByType(RecordType.MOVIE)).hasSize(2);
    }

    @Test
    @DisplayName("round-trips a tag definition (String @Id, TEXT column)")
    void tagDefinitionRoundTrips() {
        tagDefinitionRepository.save(TagDefinitionEntity.builder()
                .tagType("TRENDING")
                .displayName("Trending Now")
                .description("Computed nightly by the tag scheduler.")
                .automatic(true)
                .active(true)
                .build());
        tagDefinitionRepository.save(TagDefinitionEntity.builder()
                .tagType("EDITOR_PICK")
                .displayName("Editor's Pick")
                .automatic(false)
                .active(false)
                .build());

        flushAndClear();

        assertThat(tagDefinitionRepository.findByActiveTrueOrderByTagType())
                .extracting(TagDefinitionEntity::getTagType)
                .containsExactly("TRENDING");
    }

    // ── helpers ────────────────────────────────────────────────────────────

    private RecordEntity persistRecord(String name, RecordType type) {
        var record = RecordEntity.builder()
                .name(name)
                .type(type)
                .visibility(RecordVisibility.PUBLISHED)
                .build();
        entityManager.persist(record);
        return record;
    }

    private void persistTag(RecordEntity record, String tagType, int priority) {
        var tag = RecordTagEntity.builder()
                .record(record)
                .tagType(tagType)
                .priority(priority)
                .build();
        entityManager.persist(tag);
        record.getTags().add(tag);
    }

    private void flushAndClear() {
        entityManager.flush();
        entityManager.clear();
    }
}
