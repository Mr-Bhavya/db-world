package com.db.dbworld.app.cinema.tmdb.ingestion.impl;

import com.db.dbworld.app.cinema.tmdb.collection.entity.CollectionEntity;
import com.db.dbworld.app.cinema.tmdb.collection.repository.CollectionRepository;
import com.db.dbworld.app.cinema.tmdb.entities.MovieTmdbEntity;
import com.db.dbworld.app.cinema.tmdb.language.entity.SpokenLanguageEntity;
import com.db.dbworld.app.cinema.tmdb.language.repository.SpokenLanguageRepository;
import com.db.dbworld.app.cinema.tmdb.season.mapper.EpisodeMapper;
import com.db.dbworld.app.cinema.tmdb.season.mapper.SeasonMapper;
import com.db.dbworld.app.cinema.tmdb.service.TmdbService;
import org.springframework.stereotype.Service;
import com.db.dbworld.app.cinema.tmdb.client.dto.*;
import com.db.dbworld.app.cinema.tmdb.credits.repository.CreditRepository;
import com.db.dbworld.app.cinema.tmdb.entities.TmdbEntity;
import com.db.dbworld.app.cinema.tmdb.entities.TvSeriesTmdbEntity;
import com.db.dbworld.app.cinema.tmdb.people.entity.PersonEntity;
import com.db.dbworld.app.cinema.tmdb.people.repository.PersonRepository;
import com.db.dbworld.app.cinema.tmdb.providers.repository.ProviderRepository;
import com.db.dbworld.app.cinema.tmdb.providers.repository.TmdbProviderRepository;
import com.db.dbworld.app.cinema.tmdb.season.entity.SeasonEntity;
import com.db.dbworld.app.cinema.tmdb.season.repository.EpisodeRepository;
import com.db.dbworld.app.cinema.tmdb.season.repository.SeasonRepository;
import lombok.RequiredArgsConstructor;

import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class RelationPersistenceService {

    private final PersonRepository personRepository;
    private final CreditRepository creditRepository;
    private final ProviderRepository providerRepository;
    private final TmdbProviderRepository tmdbProviderRepository;
    private final SeasonRepository seasonRepository;
    private final EpisodeRepository episodeRepository;
    private final SpokenLanguageRepository languageRepository;
    private final CollectionRepository collectionRepository;

    private final TmdbService tmdbService;

    private final SeasonMapper seasonMapper;
    private final EpisodeMapper episodeMapper;

    public void persistPersons(TmdbEntity entity) {

        Set<PersonEntity> persons = new HashSet<>();

        entity.getCredits().forEach(c -> persons.add(c.getPerson()));

        if (entity instanceof TvSeriesTmdbEntity tv)
            persons.addAll(tv.getCreatedBy());

        personRepository.saveAll(persons);
    }

    public void persistCredits(TmdbEntity entity) {

        entity.getCredits().forEach(c -> c.setTmdb(entity));

        creditRepository.saveAll(entity.getCredits());
    }

    public void persistProviders(TmdbEntity entity) {

        entity.getProviders().forEach(p -> p.setTmdb(entity));

        tmdbProviderRepository.saveAll(entity.getProviders());
    }

    public List<SeasonEntity> persistSeasons(
            TvSeriesTmdbEntity series,
            TvSeriesTmdbResponse dto) {

        List<SeasonEntity> seasons = new ArrayList<>();

        dto.getSeasons().forEach(s -> {

            SeasonTmdbResponse season =
                    tmdbService.fetchSeason(series.getId(), s.getSeason_number()).block();

            SeasonEntity entity = seasonMapper.fromTmdb(season);

            entity.setTvShow(series);

            seasons.add(entity);

            episodeRepository.saveAll(
                    episodeMapper.fromTmdbList(season.getEpisodes(), entity)
            );

        });

        return seasonRepository.saveAll(seasons);
    }

    public void persistLanguages(TmdbEntity entity) {

        if (entity.getSpokenLanguages() == null || entity.getSpokenLanguages().isEmpty())
            return;

        Map<String, SpokenLanguageEntity> unique =
                entity.getSpokenLanguages()
                        .stream()
                        .collect(Collectors.toMap(
                                SpokenLanguageEntity::getIsoCode,
                                l -> l,
                                (a, b) -> a
                        ));

        Set<String> codes = unique.keySet();

        Map<String, SpokenLanguageEntity> existing =
                languageRepository.findAllById(codes)
                        .stream()
                        .collect(Collectors.toMap(
                                SpokenLanguageEntity::getIsoCode,
                                Function.identity()
                        ));

        List<SpokenLanguageEntity> toInsert =
                unique.values()
                        .stream()
                        .filter(l -> !existing.containsKey(l.getIsoCode()))
                        .toList();

        if (!toInsert.isEmpty())
            languageRepository.saveAll(toInsert);

        List<SpokenLanguageEntity> managed =
                unique.values()
                        .stream()
                        .map(l -> existing.getOrDefault(l.getIsoCode(), l))
                        .toList();

        entity.setSpokenLanguages(managed);
    }

    public void persistCollection(TmdbEntity entity) {

        if (!(entity instanceof MovieTmdbEntity movie))
            return;

        if (movie.getBelongsToCollection() == null)
            return;

        var collection = movie.getBelongsToCollection();

        Optional<CollectionEntity> existing =
                collectionRepository.findById(collection.getId());

        if (existing.isPresent()) {

            movie.setBelongsToCollection(existing.get());

        } else {

            collectionRepository.save(collection);

        }
    }
}
