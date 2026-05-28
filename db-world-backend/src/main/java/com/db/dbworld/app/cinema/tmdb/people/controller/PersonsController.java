package com.db.dbworld.app.cinema.tmdb.people.controller;

import com.db.dbworld.api.response.ApiResponse;
import com.db.dbworld.app.cinema.catalog.entities.RecordEntity;
import com.db.dbworld.app.cinema.tmdb.credits.entity.CreditEntity;
import com.db.dbworld.app.cinema.tmdb.entities.MovieTmdbEntity;
import com.db.dbworld.app.cinema.tmdb.entities.TvSeriesTmdbEntity;
import com.db.dbworld.app.cinema.tmdb.entities.TmdbEntity;
import com.db.dbworld.app.cinema.tmdb.people.dto.FilmographyItemDto;
import com.db.dbworld.app.cinema.tmdb.people.dto.PersonDetailDto;
import com.db.dbworld.app.cinema.tmdb.people.entity.PersonEntity;
import com.db.dbworld.app.cinema.tmdb.people.repository.PersonRepository;
import com.db.dbworld.core.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/cinema/persons")
@RequiredArgsConstructor
public class PersonsController {

    private final PersonRepository personRepo;

    /** GET /api/cinema/persons/{personId} — bio + filmography for a person. */
    @GetMapping("/{personId}")
    @Transactional(readOnly = true)
    public ApiResponse<PersonDetailDto> getPerson(@PathVariable Long personId) {
        PersonEntity person = personRepo.findById(personId)
                .orElseThrow(() -> new ResourceNotFoundException("Person", "id", personId));

        List<CreditEntity> credits = personRepo.findFilmography(personId);

        List<FilmographyItemDto> filmography = credits.stream()
                .map(this::toFilmographyItem)
                .toList();

        return ApiResponse.success(PersonDetailDto.builder()
                .id(person.getId())
                .name(person.getName())
                .knownForDepartment(person.getKnownForDepartment())
                .profilePath(person.getProfilePath())
                .biography(person.getBiography())
                .birthday(person.getBirthday())
                .deathday(person.getDeathday())
                .placeOfBirth(person.getPlaceOfBirth())
                .homepage(person.getHomepage())
                .imdbId(person.getImdbId())
                .alsoKnownAs(person.getAlsoKnownAs())
                .gender(person.getGender())
                .filmography(filmography)
                .build());
    }

    private FilmographyItemDto toFilmographyItem(CreditEntity c) {
        TmdbEntity tmdb = c.getTmdb();
        RecordEntity record = tmdb != null ? tmdb.getRecord() : null;
        String mediaType = "OTHER";
        if (tmdb instanceof MovieTmdbEntity) mediaType = "MOVIE";
        else if (tmdb instanceof TvSeriesTmdbEntity) mediaType = "TV_SERIES";

        return FilmographyItemDto.builder()
                .tmdbId(tmdb != null ? tmdb.getId() : null)
                .recordId(record != null ? record.getId() : null)
                .title(tmdb != null ? tmdb.getTitle() : null)
                .posterPath(tmdb != null ? tmdb.getPosterPath() : null)
                .mediaType(mediaType)
                .creditType(c.getCreditType())
                .character(c.getCharacter())
                .job(c.getJob())
                .department(c.getDepartment())
                .castOrder(c.getCastOrder())
                .build();
    }
}
