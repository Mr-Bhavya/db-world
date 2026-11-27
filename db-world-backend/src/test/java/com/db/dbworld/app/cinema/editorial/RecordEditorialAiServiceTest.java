package com.db.dbworld.app.cinema.editorial;

import com.db.dbworld.app.cinema.catalog.dto.RecordDto;
import com.db.dbworld.app.cinema.catalog.repository.RecordRepository;
import com.db.dbworld.app.cinema.catalog.service.CatalogService;
import com.db.dbworld.app.cinema.review.dto.UserReviewDto;
import com.db.dbworld.app.cinema.review.service.UserReviewService;
import com.db.dbworld.app.admin.config.service.SettingsService;
import com.db.dbworld.app.cinema.tmdb.dto.TmdbDto;
import com.db.dbworld.core.exception.DbWorldException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

class RecordEditorialAiServiceTest {

    RecordEditorialAiService service;

    @BeforeEach
    void setUp() {
        service = new RecordEditorialAiService(
                mock(CatalogService.class),
                mock(RecordRepository.class),
                mock(UserReviewService.class),
                mock(ApplicationEventPublisher.class),
                mock(SettingsService.class),
                mock(WebClient.class));
    }

    @Test
    void promptUsesFactsAndRatingsButDoesNotIncludeUserIdentity() {
        TmdbDto tmdb = new TmdbDto();
        tmdb.setTitle("Inception");
        tmdb.setOverview("A thief enters dreams.");
        tmdb.setVoteAverage(8.8);
        tmdb.setVoteCount(30_000);
        RecordDto record = new RecordDto();
        record.setTmdb(tmdb);
        UserReviewDto review = UserReviewDto.builder()
                .username("private-name")
                .rating(9)
                .content("Excellent ideas and pacing.")
                .build();

        String prompt = service.buildPrompt(record, List.of(review));

        assertThat(prompt)
                .contains("Inception")
                .contains("Excellent ideas and pacing.")
                .contains("30000")
                .doesNotContain("private-name");
    }

    @Test
    void validationRejectsShortGeneratedText() {
        assertThatThrownBy(() -> service.validate("Too generic."))
                .isInstanceOf(DbWorldException.class)
                .hasMessageContaining("too short");
    }
}
