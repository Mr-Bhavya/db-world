package com.db.dbworld.app.cinema.tmdb.people.repository;

import com.db.dbworld.app.cinema.tmdb.credits.entity.CreditEntity;
import com.db.dbworld.app.cinema.tmdb.entities.TvSeriesTmdbEntity;
import com.db.dbworld.app.cinema.tmdb.enums.CreditType;
import com.db.dbworld.app.cinema.tmdb.people.entity.PersonEntity;
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
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Deleting a person TMDB no longer has: {@code tmdb_credits} and {@code tmdb_tv_created_by}
 * both hold a foreign key to {@code tmdb_people}, so a bare {@code deleteById} fails for anyone
 * with a single credit. This runs the same sequence {@code TmdbIngestionServiceImpl.deletePerson}
 * does, against real tables, and checks the series and the other people survive it.
 */
@DataJpaTest
@ActiveProfiles("test")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import(PersonPurgeJpaTest.CacheStubConfig.class)
@DisplayName("Person purge")
class PersonPurgeJpaTest {

    /** {@code DbWorldApplication} is {@code @EnableCaching}; Boot 4's JPA slice supplies no manager. */
    @TestConfiguration
    static class CacheStubConfig {
        @Bean
        CacheManager cacheManager() {
            return new NoOpCacheManager();
        }
    }

    @Autowired PersonRepository personRepository;
    @Autowired EntityManager em;

    private PersonEntity person(long id) {
        var p = new PersonEntity();
        p.setId(id);
        p.setName("Person " + id);
        em.persist(p);
        return p;
    }

    private void credit(String creditId, TvSeriesTmdbEntity tmdb, PersonEntity person) {
        var c = new CreditEntity();
        c.setCreditId(creditId);
        c.setTmdb(tmdb);
        c.setPerson(person);
        c.setCreditType(CreditType.CAST);
        em.persist(c);
    }

    @Test
    void removesThePersonTheirCreditsAndCreatorLinksButNothingElse() {
        PersonEntity gone = person(3936383L);
        PersonEntity kept = person(287L);

        var series = new TvSeriesTmdbEntity();
        series.setId(1399L);
        series.setTitle("Series");
        series.setCreatedBy(new ArrayList<>(List.of(gone, kept)));
        em.persist(series);

        credit("c-gone", series, gone);
        credit("c-kept", series, kept);
        em.flush();
        em.clear();

        assertThat(personRepository.deleteCreditsOf(3936383L)).isEqualTo(1);
        assertThat(personRepository.deleteTvCreatorLinksOf(3936383L)).isEqualTo(1);
        personRepository.deleteById(3936383L);
        em.flush();
        em.clear();

        assertThat(personRepository.existsById(3936383L)).isFalse();
        assertThat(em.find(CreditEntity.class, "c-gone")).isNull();
        assertThat(em.find(CreditEntity.class, "c-kept")).isNotNull();

        TvSeriesTmdbEntity reloaded = em.find(TvSeriesTmdbEntity.class, 1399L);
        assertThat(reloaded).isNotNull();
        assertThat(reloaded.getCreatedBy()).extracting(PersonEntity::getId).containsExactly(287L);
    }
}
