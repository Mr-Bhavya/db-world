package com.db.dbworld.app.cinema.tmdb.ingestion.impl;//package com.db.dbworld.app.cinema.tmdb.ingestion.impl;
//
//import com.db.dbworld.app.cinema.enums.RecordType;
//import com.db.dbworld.app.cinema.tmdb.client.dto.MovieTmdbResponse;
//import com.db.dbworld.app.cinema.tmdb.client.dto.PersonTmdbResponse;
//import com.db.dbworld.app.cinema.tmdb.client.dto.TvSeriesTmdbResponse;
//import com.db.dbworld.app.cinema.tmdb.entities.MovieTmdbEntity;
//import com.db.dbworld.app.cinema.tmdb.entities.TmdbEntity;
//import com.db.dbworld.app.cinema.tmdb.entities.TvSeriesTmdbEntity;
//import com.db.dbworld.app.cinema.tmdb.ingestion.TmdbIngestionService;
//import com.db.dbworld.app.cinema.tmdb.language.entity.SpokenLanguageEntity;
//import com.db.dbworld.app.cinema.tmdb.language.repository.SpokenLanguageRepository;
//import com.db.dbworld.app.cinema.tmdb.mapper.MovieTmdbMapper;
//import com.db.dbworld.app.cinema.tmdb.mapper.TvSeriesTmdbMapper;
//import com.db.dbworld.app.cinema.tmdb.people.entity.PersonEntity;
//import com.db.dbworld.app.cinema.tmdb.people.mapper.PersonMapper;
//import com.db.dbworld.app.cinema.tmdb.people.repository.PersonRepository;
//import com.db.dbworld.app.cinema.tmdb.providers.entity.ProviderEntity;
//import com.db.dbworld.app.cinema.tmdb.providers.repository.ProviderRepository;
//import com.db.dbworld.app.cinema.tmdb.repository.TmdbRepository;
//import com.db.dbworld.app.cinema.tmdb.season.entity.EpisodeEntity;
//import com.db.dbworld.app.cinema.tmdb.season.entity.SeasonEntity;
//import com.db.dbworld.app.cinema.tmdb.season.mapper.EpisodeMapper;
//import com.db.dbworld.app.cinema.tmdb.season.mapper.SeasonMapper;
//import com.db.dbworld.app.cinema.tmdb.service.TmdbService;
//import lombok.RequiredArgsConstructor;
//import org.springframework.scheduling.annotation.Scheduled;
//import org.springframework.stereotype.Service;
//import reactor.core.publisher.Flux;
//import reactor.core.publisher.Mono;
//
//import java.util.*;
//import java.util.concurrent.ConcurrentHashMap;
//
//@Service
//@RequiredArgsConstructor
//public class TmdbIngestionServiceImplBak implements TmdbIngestionService {
//
//    private final TmdbService tmdbService;
//
//    private final MovieTmdbMapper movieMapper;
//    private final TvSeriesTmdbMapper tvMapper;
//    private final SeasonMapper seasonMapper;
//    private final EpisodeMapper episodeMapper;
//    private final PersonMapper personMapper;
//
//    private final TmdbRepository tmdbRepository;
//    private final PersonRepository personRepository;
//    private final ProviderRepository providerRepository;
//    private final SpokenLanguageRepository languageRepository;
//
//    /* ======================================================
//       LOCAL CACHE (reduces DB lookups drastically)
//       ====================================================== */
//
//    private final Map<Long, PersonEntity> personCache = new ConcurrentHashMap<>();
//    private final Map<Long, ProviderEntity> providerCache = new ConcurrentHashMap<>();
//    private final Map<String, SpokenLanguageEntity> languageCache = new ConcurrentHashMap<>();
//
//
//    /* ======================================================
//       MOVIE INGESTION
//       ====================================================== */
//
//    @Override
//    public MovieTmdbEntity ingestMovie(Long tmdbId) {
//
//        return Mono.zip(
//                tmdbService.fetchMovie(tmdbId),
//                tmdbService.fetchProviders(tmdbId, RecordType.MOVIE),
//                tmdbService.fetchAllMovieReviews(tmdbId).collectList()
//        ).map(tuple -> {
//
//            MovieTmdbResponse response = tuple.getT1();
//            response.setProviders(tuple.getT2());
//            response.setReviews(tuple.getT3());
//
//            MovieTmdbEntity entity = movieMapper.fromTmdb(response);
//
//            prePersistRelations(entity);
//
//            return tmdbRepository.save(entity);
//
//        }).block();
//    }
//
//
//    /* ======================================================
//       TV SERIES INGESTION
//       ====================================================== */
//
//    @Override
//    public TvSeriesTmdbEntity ingestTvSeries(Long tmdbId) {
//
//        return Mono.zip(
//                tmdbService.fetchTvSeries(tmdbId),
//                tmdbService.fetchProviders(tmdbId, RecordType.TV_SERIES),
//                tmdbService.fetchAllTvReviews(tmdbId).collectList()
//        ).flatMap(tuple -> {
//
//            TvSeriesTmdbResponse response = tuple.getT1();
//            response.setProviders(tuple.getT2());
//            response.setReviews(tuple.getT3());
//
//            TvSeriesTmdbEntity entity = tvMapper.fromTmdb(response);
//
//            var last = response.getLast_episode_to_air();
//            var next = response.getNext_episode_to_air();
//
//            Integer lastSeasonNumber = last != null ? last.getSeason_number() : null;
//            Integer lastEpisodeNumber = last != null ? last.getEpisode_number() : null;
//
//            Integer nextSeasonNumber = next != null ? next.getSeason_number() : null;
//            Integer nextEpisodeNumber = next != null ? next.getEpisode_number() : null;
//
//            entity.setLastEpisodeToAir(null);
//            entity.setNextEpisodeToAir(null);
//
//            prePersistRelations(entity);
//
//            TvSeriesTmdbEntity savedSeries = tmdbRepository.save(entity);
//
//            return ingestSeasons(response, savedSeries)
//
//                    .map(seasons -> {
//
//                        savedSeries.setSeasons(seasons);
//
//                        Map<String, EpisodeEntity> episodeIndex =
//                                buildEpisodeIndex(seasons);
//
//                        if (lastSeasonNumber != null && lastEpisodeNumber != null) {
//
//                            savedSeries.setLastEpisodeToAir(
//                                    episodeIndex.get(lastSeasonNumber + "_" + lastEpisodeNumber)
//                            );
//                        }
//
//                        if (nextSeasonNumber != null && nextEpisodeNumber != null) {
//
//                            savedSeries.setNextEpisodeToAir(
//                                    episodeIndex.get(nextSeasonNumber + "_" + nextEpisodeNumber)
//                            );
//                        }
//
//                        return tmdbRepository.save(savedSeries);
//
//                    });
//
//        }).block();
//    }
//
//    @Override
//    public void ingestMovies(List<Long> tmdbIds) {
//
//    }
//
//    @Override
//    public void ingestTvSeries(List<Long> tmdbIds) {
//
//    }
//
//    @Override
//    public MovieTmdbEntity refreshMovie(Long tmdbId) {
//        return null;
//    }
//
//    @Override
//    public TvSeriesTmdbEntity refreshTvSeries(Long tmdbId) {
//        return null;
//    }
//
//    @Override
//    public void deleteMedia(Long tmdbId) {
//
//    }
//
//    @Override
//    public void ingestPerson(Long personId) {
//
//    }
//
//
//    /* ======================================================
//       RELATION PRE-PERSIST
//       ====================================================== */
//
//    private void prePersistRelations(TmdbEntity entity) {
//
//        persistPersons(entity);
//        persistProviders(entity);
//        persistLanguages(entity);
//    }
//
//
//    /* ======================================================
//       PERSON CACHE + INSERT
//       ====================================================== */
//
//    private void persistPersons(TmdbEntity entity) {
//
//        Set<PersonEntity> persons = new HashSet<>();
//
//        if (entity.getCredits() != null)
//            entity.getCredits().forEach(c -> persons.add(c.getPerson()));
//
//        if (entity instanceof TvSeriesTmdbEntity tv && tv.getCreatedBy() != null)
//            persons.addAll(tv.getCreatedBy());
//
//        if (persons.isEmpty())
//            return;
//
//        List<PersonEntity> newPersons = new ArrayList<>();
//
//        for (PersonEntity person : persons) {
//
//            PersonEntity cached = personCache.get(person.getId());
//
//            if (cached != null)
//                continue;
//
//            Optional<PersonEntity> db = personRepository.findById(person.getId());
//
//            if (db.isPresent()) {
//
//                personCache.put(person.getId(), db.get());
//
//            } else {
//
//                newPersons.add(person);
//                personCache.put(person.getId(), person);
//            }
//        }
//
//        if (!newPersons.isEmpty())
//            personRepository.saveAll(newPersons);
//
//        /* attach managed references */
//
//        if (entity.getCredits() != null)
//            entity.getCredits().forEach(c ->
//                    c.setPerson(personCache.get(c.getPerson().getId()))
//            );
//
//        if (entity instanceof TvSeriesTmdbEntity tv && tv.getCreatedBy() != null)
//            tv.setCreatedBy(
//                    tv.getCreatedBy()
//                            .stream()
//                            .map(p -> personCache.get(p.getId()))
//                            .toList()
//            );
//    }
//
//
//    /* ======================================================
//       PROVIDERS CACHE
//       ====================================================== */
//
//    private void persistProviders(TmdbEntity entity) {
//
//        if (entity.getProviders() == null)
//            return;
//
//        List<ProviderEntity> newProviders = new ArrayList<>();
//
//        entity.getProviders().forEach(rel -> {
//
//            ProviderEntity provider = rel.getProvider();
//
//            ProviderEntity cached = providerCache.get(provider.getId());
//
//            if (cached != null) {
//
//                rel.setProvider(cached);
//
//            } else {
//
//                Optional<ProviderEntity> db =
//                        providerRepository.findById(provider.getId());
//
//                if (db.isPresent()) {
//
//                    providerCache.put(provider.getId(), db.get());
//                    rel.setProvider(db.get());
//
//                } else {
//
//                    providerCache.put(provider.getId(), provider);
//                    newProviders.add(provider);
//                }
//            }
//        });
//
//        if (!newProviders.isEmpty())
//            providerRepository.saveAll(newProviders);
//    }
//
//
//    /* ======================================================
//       LANGUAGE CACHE
//       ====================================================== */
//
//    private void persistLanguages(TmdbEntity entity) {
//
//        if (entity.getSpokenLanguages() == null)
//            return;
//
//        List<SpokenLanguageEntity> newLanguages = new ArrayList<>();
//
//        for (SpokenLanguageEntity lang : entity.getSpokenLanguages()) {
//
//            SpokenLanguageEntity cached =
//                    languageCache.get(lang.getIsoCode());
//
//            if (cached != null)
//                continue;
//
//            Optional<SpokenLanguageEntity> db =
//                    languageRepository.findById(lang.getIsoCode());
//
//            if (db.isPresent()) {
//
//                languageCache.put(lang.getIsoCode(), db.get());
//
//            } else {
//
//                languageCache.put(lang.getIsoCode(), lang);
//                newLanguages.add(lang);
//            }
//        }
//
//        if (!newLanguages.isEmpty())
//            languageRepository.saveAll(newLanguages);
//    }
//
//
//    /* ======================================================
//       PERSON DETAIL SYNC
//       ====================================================== */
//
//    @Scheduled(fixedDelay = 1_000_000)
//    public void syncPersonDetails() {
//
//        List<PersonEntity> persons =
//                personRepository.findTop50ByPersonSyncedFalse();
//
//        List<PersonEntity> updated = new ArrayList<>();
//
//        for (PersonEntity person : persons) {
//
//            PersonTmdbResponse dto =
//                    tmdbService.fetchPerson(person.getId()).block();
//
//            if (dto == null)
//                continue;
//
//            person.setBiography(dto.getBiography());
//            person.setImdbId(dto.getImdb_id());
//            person.setPlaceOfBirth(dto.getPlace_of_birth());
//            person.setPersonSynced(true);
//
//            updated.add(person);
//        }
//
//        personRepository.saveAll(updated);
//    }
//
//
//    /* ======================================================
//       SEASONS INGESTION
//       ====================================================== */
//
//    private Mono<List<SeasonEntity>> ingestSeasons(
//            TvSeriesTmdbResponse dto,
//            TvSeriesTmdbEntity series
//    ) {
//
//        if (dto.getSeasons() == null)
//            return Mono.just(Collections.emptyList());
//
//        return Flux.fromIterable(dto.getSeasons())
//
//                .flatMap(season ->
//                        tmdbService.fetchSeason(
//                                series.getId(),
//                                season.getSeason_number()
//                        ), 4)
//
//                .map(seasonDto -> {
//
//                    SeasonEntity season =
//                            seasonMapper.fromTmdb(seasonDto);
//
//                    season.setTvShow(series);
//
//                    List<EpisodeEntity> episodes =
//                            episodeMapper.fromTmdbList(
//                                    seasonDto.getEpisodes(),
//                                    season
//                            );
//
//                    if (episodes != null) {
//
//                        episodes.forEach(e -> e.setSeason(season));
//
//                        season.setEpisodes(episodes);
//                    }
//
//                    return season;
//
//                })
//                .collectList();
//    }
//
//
//    /* ======================================================
//       EPISODE INDEX (O(1) lookup)
//       ====================================================== */
//
//    private Map<String, EpisodeEntity> buildEpisodeIndex(
//            List<SeasonEntity> seasons
//    ) {
//
//        Map<String, EpisodeEntity> map = new HashMap<>();
//
//        for (SeasonEntity season : seasons) {
//
//            for (EpisodeEntity episode : season.getEpisodes()) {
//
//                map.put(
//                        season.getSeasonNumber()
//                                + "_" +
//                                episode.getEpisodeNumber(),
//                        episode
//                );
//            }
//        }
//
//        return map;
//    }
//}