package com.db.dbworld.app.cinema.rail.util;

import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.cache.CacheManager;
import org.springframework.cache.support.NoOpCacheManager;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Sort-field discovery. The point of {@link RailSortBuilder} scanning the JPA metamodel is that
 * adding a column to RecordEntity or TmdbEntity makes it sortable with NO code change here and none
 * in the frontend — so these assert the discovery itself, not a hand-maintained list.
 *
 * <p>Needs a real JPA metamodel, hence the {@code @DataJpaTest} slice. The builder is constructed
 * directly rather than autowired: it is a {@code @Component} outside the repository slice's scan.
 */
@DataJpaTest
@ActiveProfiles("test")
// replace = NONE is load-bearing: without it Boot swaps in its own embedded DataSource and discards
// the configured H2 URL, whose INIT=CREATE SCHEMA clause is what makes @Table(schema="db_world")
// resolvable. Symptom is a confusing 'Schema "DB_WORLD" not found'.
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class RailSortBuilderDiscoveryTest {

    /** Boot 4's JPA slice no longer imports cache auto-config, but the app is @EnableCaching. */
    @TestConfiguration
    static class NoCacheConfig {
        @Bean CacheManager cacheManager() { return new NoOpCacheManager(); }
    }

    @Autowired EntityManager entityManager;

    RailSortBuilder builder;

    @BeforeEach
    void setUp() {
        builder = new RailSortBuilder(entityManager);
        builder.discoverFields();
    }

    private List<String> fieldNames() {
        return builder.availableFields().stream().map(RailSortBuilder.SortField::value).toList();
    }

    @Test
    void discovers_recordEntityColumns_withoutBeingRegistered() {
        // publishedAt is the field that prompted this: it used to need a hand-written FIELD_MAP entry
        // AND a frontend label entry. Now the metamodel finds it.
        assertThat(fieldNames()).contains("publishedAt", "createdAt", "updatedAt", "name", "id");
    }

    @Test
    void discovers_tmdbColumns_throughTheJoin() {
        assertThat(fieldNames()).contains("popularity", "voteAverage", "voteCount");
        assertThat(builder.build("popularity", "DESC").toString()).contains("tmdb.popularity");
    }

    @Test
    void doesNotExpose_subclassOnlyTmdbColumns() {
        // TmdbEntity is a SINGLE_TABLE hierarchy: releaseDate is movie-only and firstAirDate is
        // series-only, so ordering a mixed Home rail by either would fail for half its rows. That is
        // what the denormalised primaryDate column is for.
        assertThat(fieldNames()).doesNotContain("releaseDate", "firstAirDate");
        assertThat(fieldNames()).contains("releaseAirDate");
        assertThat(builder.build("releaseAirDate", "DESC").toString()).contains("tmdb.primaryDate");
    }

    @Test
    void doesNotExpose_associationsOrCollections() {
        // Ordering by a to-one or a collection is not expressible as a Pageable sort.
        assertThat(fieldNames()).doesNotContain("tmdb", "record", "tags", "genres", "videos", "images");
    }

    @Test
    void doesNotExpose_proseAndAssetUrls() {
        // Technically orderable, meaningless for a rail — kept out so the dropdown stays usable.
        assertThat(fieldNames()).doesNotContain("overview", "posterPath", "backdropPath", "homepage", "tagline");
    }

    @Test
    void curatedAliasReplacesRawAttributeName_soOrderingIsOfferedOnce() {
        assertThat(fieldNames()).contains("topRated");
        assertThat(fieldNames()).doesNotContain("weightedRating");
        assertThat(builder.build("topRated", "DESC").toString()).contains("tmdb.weightedRating");
    }

    @Test
    void everyDiscoveredField_resolvesToARealSort() {
        // Guards the actual failure mode: a field offered in the dropdown that blows up at render.
        for (String f : fieldNames()) {
            if (RailSortBuilder.TAG_PRIORITY.equals(f)) continue;
            assertThat(builder.build(f, "DESC").isSorted())
                    .as("field %s should produce a usable Sort", f)
                    .isTrue();
        }
    }

    @Test
    void unknownField_fallsBackToUnsortedInsteadOfThrowing() {
        assertThat(builder.build("notAColumn", "DESC").isUnsorted()).isTrue();
        assertThat(builder.isKnownField("notAColumn")).isFalse();
    }

    @Test
    void legacySortValuesStillResolve() {
        // Old rails may still store these; they must not silently become unsorted.
        assertThat(builder.build("releaseDate", "DESC").toString()).contains("tmdb.primaryDate");
        assertThat(builder.build("firstAirDate", "DESC").toString()).contains("tmdb.primaryDate");
        assertThat(builder.isKnownField("releaseDate")).isTrue();
    }

    @Test
    void everyFieldHasANonEmptyLabel() {
        assertThat(builder.availableFields())
                .allSatisfy(f -> assertThat(f.label()).isNotBlank());
    }

    @Test
    void humanize_derivesAReadableLabelForUnlistedFields() {
        // The reason a brand-new column needs no frontend edit.
        assertThat(RailSortBuilder.humanize("newContentAt")).isEqualTo("New content at");
        assertThat(RailSortBuilder.humanize("voteCount")).isEqualTo("Vote count");
    }
}
