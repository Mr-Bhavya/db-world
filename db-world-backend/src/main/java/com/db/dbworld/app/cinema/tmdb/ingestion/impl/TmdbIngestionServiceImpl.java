package com.db.dbworld.app.cinema.tmdb.ingestion.impl;

import com.db.dbworld.app.cinema.catalog.repository.RecordRepository;
import com.db.dbworld.app.cinema.enums.RecordType;
import com.db.dbworld.app.cinema.tmdb.client.dto.*;
import com.db.dbworld.app.cinema.tmdb.collection.entity.CollectionEntity;
import com.db.dbworld.app.cinema.tmdb.collection.repository.CollectionRepository;
import com.db.dbworld.app.cinema.tmdb.credits.entity.CreditEntity;
import com.db.dbworld.app.cinema.tmdb.entities.*;
import com.db.dbworld.app.cinema.tmdb.exception.TmdbIngestionException;
import com.db.dbworld.app.cinema.tmdb.exception.TmdbNotFoundException;
import com.db.dbworld.app.cinema.tmdb.ingestion.TmdbIngestionService;
import com.db.dbworld.app.cinema.tmdb.language.entity.SpokenLanguageEntity;
import com.db.dbworld.app.cinema.tmdb.language.repository.SpokenLanguageRepository;
import com.db.dbworld.app.cinema.tmdb.mapper.*;
import com.db.dbworld.app.cinema.tmdb.people.entity.PersonEntity;
import com.db.dbworld.app.cinema.tmdb.people.mapper.PersonMapper;
import com.db.dbworld.app.cinema.tmdb.people.repository.PersonRepository;
import com.db.dbworld.app.cinema.tmdb.providers.entity.ProviderEntity;
import com.db.dbworld.app.cinema.tmdb.providers.entity.TmdbProviderEntity;
import com.db.dbworld.app.cinema.tmdb.providers.repository.ProviderRepository;
import com.db.dbworld.app.cinema.tmdb.providers.repository.TmdbProviderRepository;
import com.db.dbworld.app.cinema.tmdb.repository.TmdbRepository;
import com.db.dbworld.app.cinema.tmdb.season.entity.*;
import com.db.dbworld.app.cinema.tmdb.season.mapper.*;
import com.db.dbworld.app.cinema.tmdb.season.repository.EpisodeRepository;
import com.db.dbworld.app.cinema.tmdb.season.repository.SeasonRepository;
import com.db.dbworld.app.cinema.tmdb.service.TmdbService;

import com.db.dbworld.core.exception.ResourceNotFoundException;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Function;
import java.util.stream.Collectors;

@Log4j2
@Service
@Transactional
@RequiredArgsConstructor
public class TmdbIngestionServiceImpl implements TmdbIngestionService {

    private final TmdbService tmdbService;

    private final MovieTmdbMapper movieMapper;
    private final TvSeriesTmdbMapper tvMapper;
    private final SeasonMapper seasonMapper;
    private final EpisodeMapper episodeMapper;
    private final PersonMapper personMapper;

    private final TmdbRepository tmdbRepository;
    private final PersonRepository personRepository;
    private final ProviderRepository providerRepository;
    private final SeasonRepository seasonRepository;
    private final EpisodeRepository episodeRepository;
    private final SpokenLanguageRepository languageRepository;
    private final CollectionRepository collectionRepository;
    private final RecordRepository recordRepository;

    // Caches for better performance
    private final Map<Long, PersonEntity> personCache = new ConcurrentHashMap<>();
    private final Map<Long, ProviderEntity> providerCache = new ConcurrentHashMap<>();
    private final Map<String, SpokenLanguageEntity> languageCache = new ConcurrentHashMap<>();

    /* ======================================================
       MOVIE INGESTION - Only inserts if not exists
       ====================================================== */

    @Override
    public MovieTmdbEntity ingestMovie(Long tmdbId) {
        validateTmdbId(tmdbId);

        if (tmdbRepository.existsById(tmdbId)) {
            throw new TmdbIngestionException("Movie with ID " + tmdbId + " already exists");
        }

        try {
            return fetchAndSaveMovie(tmdbId);
        } catch (Exception e) {
            log.error("Failed to ingest movie {}", tmdbId, e);
            throw new TmdbIngestionException("Failed to ingest movie " + tmdbId, e);
        }
    }

    private MovieTmdbEntity fetchAndSaveMovie(Long tmdbId) {
        MovieTmdbResponse response = fetchMovieData(tmdbId);
        MovieTmdbEntity entity = movieMapper.fromTmdb(response);

        prePersistRelations(entity);
        return tmdbRepository.save(entity);
    }

    private MovieTmdbResponse fetchMovieData(Long tmdbId) {
        return Mono.zip(
                tmdbService.fetchMovie(tmdbId),
                tmdbService.fetchProviders(tmdbId, RecordType.MOVIE),
                tmdbService.fetchAllMovieReviews(tmdbId).collectList()
        ).map(tuple -> {
            MovieTmdbResponse response = tuple.getT1();
            response.setProviders(tuple.getT2());
            response.setReviews(tuple.getT3());
            return response;
        }).block();
    }

    /* ======================================================
       TV SERIES INGESTION - Only inserts if not exists
       ====================================================== */

    @Override
    public TvSeriesTmdbEntity ingestTvSeries(Long tmdbId) {
        validateTmdbId(tmdbId);

        if (tmdbRepository.existsById(tmdbId)) {
            throw new TmdbIngestionException("TV Series with ID " + tmdbId + " already exists");
        }

        try {
            return fetchAndSaveTvSeries(tmdbId);
        } catch (Exception e) {
            log.error("Failed to ingest TV series {}", tmdbId, e);
            throw new TmdbIngestionException("Failed to ingest TV series " + tmdbId, e);
        }
    }

    private TvSeriesTmdbEntity fetchAndSaveTvSeries(Long tmdbId) {
        TvSeriesTmdbResponse response = fetchTvSeriesData(tmdbId);
        TvSeriesTmdbEntity entity = tvMapper.fromTmdb(response);

        // Extract episode info BEFORE saving anything
        EpisodeInfo lastEpisode = extractEpisodeInfo(response.getLast_episode_to_air());
        EpisodeInfo nextEpisode = extractEpisodeInfo(response.getNext_episode_to_air());

        // Clear these fields initially (they'll be set after saving episodes)
        entity.setLastEpisodeToAir(null);
        entity.setNextEpisodeToAir(null);

        // Save related entities that don't depend on the TV series ID
        prePersistRelations(entity);

        // FIRST: Save the TV series to get it in the database
        TvSeriesTmdbEntity savedSeries = tmdbRepository.save(entity);

        // SECOND: Create and save seasons with episodes
        List<SeasonEntity> seasons = ingestSeasonsBlocking(response, savedSeries);

        Map<String, EpisodeEntity> episodeIndex = new HashMap<>();

        if (!seasons.isEmpty()) {
            // Save all seasons first
            List<SeasonEntity> savedSeasons = seasonRepository.saveAll(seasons);

            // Build episode index from saved seasons
            for (SeasonEntity season : savedSeasons) {
                if (season.getEpisodes() != null) {
                    for (EpisodeEntity episode : season.getEpisodes()) {
                        String key = season.getSeasonNumber() + "_" + episode.getEpisodeNumber();
                        episodeIndex.put(key, episode);
                    }
                }
            }

            // IMPORTANT: Don't replace the collection - modify the existing one
            List<SeasonEntity> currentSeasons = savedSeries.getSeasons();
            if (currentSeasons == null) {
                // First time - initialize with new ArrayList
                savedSeries.setSeasons(new ArrayList<>());
                currentSeasons = savedSeries.getSeasons();
            } else {
                // Clear existing seasons (this is safe - same collection instance)
                currentSeasons.clear();
            }

            // Add all saved seasons to the existing collection
            currentSeasons.addAll(savedSeasons);
        }

        // THIRD: Set last/next episode references using SAVED episodes
        if (lastEpisode != null) {
            EpisodeEntity lastEp = episodeIndex.get(lastEpisode.getKey());
            if (lastEp != null) {
                savedSeries.setLastEpisodeToAir(lastEp);
            }
        }

        if (nextEpisode != null) {
            EpisodeEntity nextEp = episodeIndex.get(nextEpisode.getKey());
            if (nextEp != null) {
                savedSeries.setNextEpisodeToAir(nextEp);
            }
        }

        // FINALLY: Update the TV series
        return tmdbRepository.save(savedSeries);
    }

    private TvSeriesTmdbResponse fetchTvSeriesData(Long tmdbId) {
        return Mono.zip(
                tmdbService.fetchTvSeries(tmdbId),
                tmdbService.fetchProviders(tmdbId, RecordType.TV_SERIES),
                tmdbService.fetchAllTvReviews(tmdbId).collectList()
        ).map(tuple -> {
            TvSeriesTmdbResponse response = tuple.getT1();
            response.setProviders(tuple.getT2());
            response.setReviews(tuple.getT3());
            return response;
        }).block();
    }

    private void updateEpisodeReferences(TvSeriesTmdbEntity series, List<SeasonEntity> seasons,
                                         EpisodeInfo last, EpisodeInfo next) {
        Map<String, EpisodeEntity> episodeIndex = buildEpisodeIndex(seasons);

        if (last != null) {
            series.setLastEpisodeToAir(episodeIndex.get(last.getKey()));
        }
        if (next != null) {
            series.setNextEpisodeToAir(episodeIndex.get(next.getKey()));
        }
    }

    /* ======================================================
       BATCH INGESTION
       ====================================================== */

    @Override
    public List<MovieTmdbEntity> ingestMovies(List<Long> tmdbIds) {
        if (isEmpty(tmdbIds)) {
            return Collections.emptyList();
        }

        List<MovieTmdbEntity> results = new ArrayList<>();
        List<Long> existingIds = tmdbRepository.findAllById(tmdbIds).stream()
                .map(TmdbEntity::getId)
                .toList();

        for (Long id : tmdbIds) {
            if (existingIds.contains(id)) {
                log.warn("Movie with ID {} already exists, skipping", id);
                continue;
            }
            try {
                results.add(ingestMovie(id));
            } catch (Exception e) {
                log.error("Failed to ingest movie {}", id, e);
            }
        }
        return results;
    }

    @Override
    public List<TvSeriesTmdbEntity> ingestTvSeries(List<Long> tmdbIds) {
        if (isEmpty(tmdbIds)) {
            return Collections.emptyList();
        }

        List<TvSeriesTmdbEntity> results = new ArrayList<>();
        List<Long> existingIds = tmdbRepository.findAllById(tmdbIds).stream()
                .map(TmdbEntity::getId)
                .toList();

        for (Long id : tmdbIds) {
            if (existingIds.contains(id)) {
                log.warn("TV Series with ID {} already exists, skipping", id);
                continue;
            }
            try {
                results.add(ingestTvSeries(id));
            } catch (Exception e) {
                log.error("Failed to ingest TV series {}", id, e);
            }
        }
        return results;
    }

    /* ======================================================
       REFRESH - Delete and insert again
       ====================================================== */

    @Override
    public MovieTmdbEntity refreshMovie(Long tmdbId) {
        validateTmdbId(tmdbId);

        try {
            deleteMedia(tmdbId);
            MovieTmdbEntity movieTmdbEntity = ingestMovie(tmdbId);
        } catch (Exception e) {
            log.error("Failed to refresh movie {}", tmdbId, e);
            throw new TmdbIngestionException("Failed to refresh movie " + tmdbId, e);
        }
    }

    @Override
    public TvSeriesTmdbEntity refreshTvSeries(Long tmdbId) {
        validateTmdbId(tmdbId);

        try {
            deleteMedia(tmdbId);
            return ingestTvSeries(tmdbId);
        } catch (Exception e) {
            log.error("Failed to refresh TV series {}", tmdbId, e);
            throw new TmdbIngestionException("Failed to refresh TV series " + tmdbId, e);
        }
    }

    @Override
    public List<MovieTmdbEntity> refreshMovies(List<Long> tmdbIds) {
        if (isEmpty(tmdbIds)) {
            return Collections.emptyList();
        }

        List<MovieTmdbEntity> results = new ArrayList<>();
        for (Long id : tmdbIds) {
            try {
                results.add(refreshMovie(id));
            } catch (Exception e) {
                log.error("Failed to refresh movie {}", id, e);
            }
        }
        return results;
    }

    @Override
    public List<TvSeriesTmdbEntity> refreshTvSeries(List<Long> tmdbIds) {
        if (isEmpty(tmdbIds)) {
            return Collections.emptyList();
        }

        List<TvSeriesTmdbEntity> results = new ArrayList<>();
        for (Long id : tmdbIds) {
            try {
                results.add(refreshTvSeries(id));
            } catch (Exception e) {
                log.error("Failed to refresh TV series {}", id, e);
            }
        }
        return results;
    }

    /* ======================================================
       DELETE
       ====================================================== */

    @Override
    public void deleteMedia(Long tmdbId) {
        validateTmdbId(tmdbId);

        if (!tmdbRepository.existsById(tmdbId)) {
            throw new TmdbNotFoundException("Media with ID " + tmdbId + " not found");
        }

        try {
            tmdbRepository.deleteById(tmdbId);
            // Clear from caches if needed
            personCache.remove(tmdbId);
        } catch (Exception e) {
            log.error("Failed to delete media {}", tmdbId, e);
            throw new TmdbIngestionException("Failed to delete media " + tmdbId, e);
        }
    }

    @Override
    public void deleteMedia(List<Long> tmdbIds) {
        if (isEmpty(tmdbIds)) {
            return;
        }

        for (Long id : tmdbIds) {
            try {
                deleteMedia(id);
            } catch (Exception e) {
                log.error("Failed to delete media {}", id, e);
            }
        }
    }

    /* ======================================================
       PERSON INGESTION
       ====================================================== */

    @Override
    public PersonEntity ingestPerson(Long personId) {
        validateTmdbId(personId);

        if (personRepository.existsById(personId)) {
            throw new TmdbIngestionException("Person with ID " + personId + " already exists");
        }

        try {
            PersonTmdbResponse response = tmdbService.fetchPerson(personId).block();
            if (response == null) {
                throw new TmdbNotFoundException("Person with ID " + personId + " not found in TMDB");
            }

            PersonEntity person = personMapper.fromTmdb(response);
            return personRepository.save(person);
        } catch (Exception e) {
            log.error("Failed to ingest person {}", personId, e);
            throw new TmdbIngestionException("Failed to ingest person " + personId, e);
        }
    }

    @Override
    public List<PersonEntity> ingestPersons(List<Long> personIds) {
        if (isEmpty(personIds)) {
            return Collections.emptyList();
        }

        List<PersonEntity> results = new ArrayList<>();
        List<Long> existingIds = personRepository.findAllById(personIds).stream()
                .map(PersonEntity::getId)
                .toList();

        for (Long id : personIds) {
            if (existingIds.contains(id)) {
                log.warn("Person with ID {} already exists, skipping", id);
                continue;
            }
            try {
                results.add(ingestPerson(id));
            } catch (Exception e) {
                log.error("Failed to ingest person {}", id, e);
            }
        }
        return results;
    }

    @Override
    public PersonEntity refreshPerson(Long personId) {
        validateTmdbId(personId);

        try {
            if (personRepository.existsById(personId)) {
                personRepository.deleteById(personId);
            }
            return ingestPerson(personId);
        } catch (Exception e) {
            log.error("Failed to refresh person {}", personId, e);
            throw new TmdbIngestionException("Failed to refresh person " + personId, e);
        }
    }

    @Override
    public List<PersonEntity> refreshPersons(List<Long> personIds) {
        if (isEmpty(personIds)) {
            return Collections.emptyList();
        }

        List<PersonEntity> results = new ArrayList<>();
        for (Long id : personIds) {
            try {
                results.add(refreshPerson(id));
            } catch (Exception e) {
                log.error("Failed to refresh person {}", id, e);
            }
        }
        return results;
    }

    @Override
    public void deletePerson(Long personId) {
        validateTmdbId(personId);

        if (!personRepository.existsById(personId)) {
            throw new TmdbNotFoundException("Person with ID " + personId + " not found");
        }

        try {
            personRepository.deleteById(personId);
        } catch (Exception e) {
            log.error("Failed to delete person {}", personId, e);
            throw new TmdbIngestionException("Failed to delete person " + personId, e);
        }
    }

    @Override
    public void deletePersons(List<Long> personIds) {
        if (isEmpty(personIds)) {
            return;
        }

        for (Long id : personIds) {
            try {
                deletePerson(id);
            } catch (Exception e) {
                log.error("Failed to delete person {}", id, e);
            }
        }
    }

    /* ======================================================
       PERSON DETAIL SYNC
       ====================================================== */

//    @Scheduled(fixedDelay = 1_000_000)
    public void syncPersonDetails() {
        List<PersonEntity> persons = personRepository.findTop50ByPersonSyncedFalse();
        if (persons.isEmpty()) {
            return;
        }

        List<PersonEntity> updated = new ArrayList<>();

        for (PersonEntity person : persons) {
            try {
                PersonTmdbResponse dto = tmdbService.fetchPerson(person.getId()).block();
                if (dto == null) {
                    log.warn("Person {} not found in TMDB", person.getId());
                    continue;
                }

                person.setBiography(dto.getBiography());
                person.setImdbId(dto.getImdb_id());
                person.setPlaceOfBirth(dto.getPlace_of_birth());
                person.setPersonSynced(true);

                updated.add(person);
            } catch (Exception e) {
                log.error("Failed to sync person details for ID: {}", person.getId(), e);
            }
        }

        if (!updated.isEmpty()) {
            personRepository.saveAll(updated);
        }
    }

    /* ======================================================
       RELATION PERSISTENCE
       ====================================================== */

    private void prePersistRelations(TmdbEntity entity) {
        persistCollection(entity);
        persistPersons(entity);
        persistProviders(entity);
        persistLanguages(entity);
    }

    private void persistCollection(TmdbEntity entity) {

        if (!(entity instanceof MovieTmdbEntity movie)) {
            return;
        }

        if (movie.getBelongsToCollection() == null) {
            return;
        }

        CollectionEntity collection = movie.getBelongsToCollection();

        Optional<CollectionEntity> existing =
                collectionRepository.findById(collection.getId());

        if (existing.isPresent()) {

            movie.setBelongsToCollection(existing.get());

            return;
        }

        try {

            CollectionEntity saved =
                    collectionRepository.save(collection);

            movie.setBelongsToCollection(saved);

            log.debug("Saved TMDB collection {}", saved.getId());

        } catch (DataIntegrityViolationException e) {

            log.warn("Collection {} already exists (race condition)", collection.getId());

            movie.setBelongsToCollection(
                    collectionRepository.findById(collection.getId()).orElseThrow()
            );
        }
    }

    private void persistPersons(TmdbEntity entity) {
        Set<PersonEntity> persons = extractPersons(entity);
        if (persons.isEmpty()) {
            return;
        }

        // Process new persons
        List<PersonEntity> newPersons = findNewPersons(persons);
        if (!newPersons.isEmpty()) {
            List<PersonEntity> saved = personRepository.saveAll(newPersons);
            saved.forEach(p -> personCache.put(p.getId(), p));
        }

        // Attach managed references
        attachPersonReferences(entity);
    }

    private Set<PersonEntity> extractPersons(TmdbEntity entity) {
        Set<PersonEntity> persons = new HashSet<>();

        if (entity.getCredits() != null) {
            persons.addAll(entity.getCredits().stream()
                    .map(CreditEntity::getPerson)
                    .filter(Objects::nonNull)
                    .collect(Collectors.toSet()));
        }

        if (entity instanceof TvSeriesTmdbEntity tv && tv.getCreatedBy() != null) {
            persons.addAll(tv.getCreatedBy());
        }

        return persons;
    }

    private List<PersonEntity> findNewPersons(Set<PersonEntity> persons) {
        List<PersonEntity> newPersons = new ArrayList<>();

        for (PersonEntity person : persons) {
            if (!personCache.containsKey(person.getId())) {
                Optional<PersonEntity> existing = personRepository.findById(person.getId());
                if (existing.isPresent()) {
                    personCache.put(person.getId(), existing.get());
                } else {
                    newPersons.add(person);
                    personCache.put(person.getId(), person);
                }
            }
        }

        return newPersons;
    }

    private void attachPersonReferences(TmdbEntity entity) {
        if (entity.getCredits() != null) {
            entity.getCredits().forEach(credit ->
                    credit.setPerson(personCache.get(credit.getPerson().getId()))
            );
        }

        if (entity instanceof TvSeriesTmdbEntity tv && tv.getCreatedBy() != null) {
            tv.setCreatedBy(tv.getCreatedBy().stream()
                    .map(p -> personCache.get(p.getId()))
                    .filter(Objects::nonNull)
                    .toList());
        }
    }

    private void persistProviders(TmdbEntity entity) {
        if (isEmpty(entity.getProviders())) {
            return;
        }

        Set<TmdbProviderEntity> deduplicated = new HashSet<>();
        Set<String> seen = new HashSet<>();
        List<ProviderEntity> newProviders = new ArrayList<>();

        for (TmdbProviderEntity rel : entity.getProviders()) {
            ProviderEntity provider = rel.getProvider();

            // Handle provider
            ProviderEntity managedProvider = getOrCreateProvider(provider, newProviders);
            rel.setProvider(managedProvider);

            // Deduplicate relations
            String key = entity.getId() + "_" + managedProvider.getId() + "_" +
                    rel.getProviderType() + "_" + rel.getRegionCode();

            if (seen.add(key)) {
                rel.setTmdb(entity);
                deduplicated.add(rel);
            }
        }

        if (!newProviders.isEmpty()) {
            providerRepository.saveAll(newProviders);
        }

        entity.setProviders(deduplicated);
    }

    private ProviderEntity getOrCreateProvider(ProviderEntity provider, List<ProviderEntity> newProviders) {
        ProviderEntity cached = providerCache.get(provider.getId());
        if (cached != null) {
            return cached;
        }

        Optional<ProviderEntity> existing = providerRepository.findById(provider.getId());
        if (existing.isPresent()) {
            providerCache.put(provider.getId(), existing.get());
            return existing.get();
        }

        providerCache.put(provider.getId(), provider);
        newProviders.add(provider);
        return provider;
    }

    private void persistLanguages(TmdbEntity entity) {
        if (isEmpty(entity.getSpokenLanguages())) {
            return;
        }

        List<SpokenLanguageEntity> newLanguages = new ArrayList<>();

        for (SpokenLanguageEntity lang : entity.getSpokenLanguages()) {
            if (!languageCache.containsKey(lang.getIsoCode())) {
                Optional<SpokenLanguageEntity> existing = languageRepository.findById(lang.getIsoCode());
                if (existing.isPresent()) {
                    languageCache.put(lang.getIsoCode(), existing.get());
                } else {
                    languageCache.put(lang.getIsoCode(), lang);
                    newLanguages.add(lang);
                }
            }
        }

        if (!newLanguages.isEmpty()) {
            languageRepository.saveAll(newLanguages);
        }
    }

    /* ======================================================
       SEASONS INGESTION
       ====================================================== */

    private List<SeasonEntity> ingestSeasonsBlocking(TvSeriesTmdbResponse dto, TvSeriesTmdbEntity series) {
        if (isEmpty(dto.getSeasons())) {
            return Collections.emptyList();
        }

        List<SeasonEntity> seasons = new ArrayList<>();

        for (SeasonTmdbResponse season : dto.getSeasons()) {
            SeasonTmdbResponse seasonDto = tmdbService.fetchSeason(series.getId(), season.getSeason_number()).block();
            if (seasonDto != null) {
                SeasonEntity seasonEntity = createSeason(seasonDto, series);

                // Ensure the season has the series reference
                seasonEntity.setTvShow(series);

                seasons.add(seasonEntity);
            }
        }

        return seasons;
    }

    private SeasonEntity createSeason(SeasonTmdbResponse dto, TvSeriesTmdbEntity series) {
        Optional<SeasonEntity> existing = seasonRepository.findById(dto.getId());

        return existing.map(season -> updateExistingSeason(season, dto)).orElseGet(() -> createNewSeason(dto, series));

    }

    private SeasonEntity updateExistingSeason(SeasonEntity season, SeasonTmdbResponse dto) {
        season.setName(dto.getName());
        season.setOverview(dto.getOverview());
        season.setPosterPath(dto.getPoster_path());
        season.setAirDate(dto.getAir_date());
        season.setEpisodeCount(dto.getEpisodes() != null ? dto.getEpisodes().size() : 0);
        season.setVoteAverage(dto.getVote_average());

        updateSeasonEpisodes(season, dto);
        return season;
    }

    private SeasonEntity createNewSeason(SeasonTmdbResponse dto, TvSeriesTmdbEntity series) {
        SeasonEntity season = seasonMapper.fromTmdb(dto);
        season.setTvShow(series);

        List<EpisodeEntity> episodes = episodeMapper.fromTmdbList(dto.getEpisodes(), season);
        if (episodes != null) {
            episodes.forEach(e -> e.setSeason(season));
            season.setEpisodes(episodes);
        }

        return season;
    }

    private void updateSeasonEpisodes(SeasonEntity season, SeasonTmdbResponse dto) {
        List<EpisodeEntity> existingEpisodes = episodeRepository.findBySeasonId(season.getId());
        Map<Long, EpisodeEntity> existingMap = existingEpisodes.stream()
                .collect(Collectors.toMap(EpisodeEntity::getId, Function.identity()));

        List<EpisodeEntity> dtoEpisodes = episodeMapper.fromTmdbList(dto.getEpisodes(), season);
        if (dtoEpisodes == null) return;

        Set<Long> idsToKeep = new HashSet<>();
        List<EpisodeEntity> episodesToSave = new ArrayList<>();

        for (EpisodeEntity dtoEpisode : dtoEpisodes) {
            if (dtoEpisode.getId() != null && existingMap.containsKey(dtoEpisode.getId())) {
                EpisodeEntity existing = existingMap.get(dtoEpisode.getId());
                updateEpisodeFields(existing, dtoEpisode);
                episodesToSave.add(existing);
                idsToKeep.add(existing.getId());
            } else {
                dtoEpisode.setSeason(season);
                episodesToSave.add(dtoEpisode);
                if (dtoEpisode.getId() != null) {
                    idsToKeep.add(dtoEpisode.getId());
                }
            }
        }

        // Delete removed episodes
        List<EpisodeEntity> toDelete = existingEpisodes.stream()
                .filter(ep -> !idsToKeep.contains(ep.getId()))
                .collect(Collectors.toList());

        if (!toDelete.isEmpty()) {
            episodeRepository.deleteAll(toDelete);
        }

        if (!episodesToSave.isEmpty()) {
            episodeRepository.saveAll(episodesToSave);
        }
    }

    private void updateEpisodeFields(EpisodeEntity existing, EpisodeEntity newEpisode) {
        existing.setName(newEpisode.getName());
        existing.setOverview(newEpisode.getOverview());
        existing.setAirDate(newEpisode.getAirDate());
        existing.setRuntime(newEpisode.getRuntime());
        existing.setVoteAverage(newEpisode.getVoteAverage());
        existing.setVoteCount(newEpisode.getVoteCount());
        existing.setStillPath(newEpisode.getStillPath());
        existing.setSeasonNumber(newEpisode.getSeasonNumber());
    }

    private Map<String, EpisodeEntity> buildEpisodeIndex(List<SeasonEntity> seasons) {
        Map<String, EpisodeEntity> index = new HashMap<>();

        for (SeasonEntity season : seasons) {
            if (season.getEpisodes() != null) {
                for (EpisodeEntity episode : season.getEpisodes()) {
                    index.put(season.getSeasonNumber() + "_" + episode.getEpisodeNumber(), episode);
                }
            }
        }

        return index;
    }

    /* ======================================================
       UTILITY METHODS
       ====================================================== */

    private record EpisodeInfo(Integer seasonNumber, Integer episodeNumber) {
        String getKey() {
            return seasonNumber + "_" + episodeNumber;
        }
    }

    private EpisodeInfo extractEpisodeInfo(EpisodeTmdbResponse episode) {
        return episode != null
                ? new EpisodeInfo(episode.getSeason_number(), episode.getEpisode_number())
                : null;
    }

    private void validateTmdbId(Long id) {
        if (id == null || id <= 0) {
            throw new IllegalArgumentException("Invalid TMDB ID: " + id);
        }
    }

    private boolean isEmpty(Collection<?> collection) {
        return collection == null || collection.isEmpty();
    }
}