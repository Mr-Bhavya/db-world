package com.db.dbworld.services.Impl;

import com.db.dbworld.dao.dbcinema.DBCinemaRecordsRepository;
import com.db.dbworld.dao.dbcinema.tmdb.GenresRepository;
import com.db.dbworld.dao.dbcinema.tmdb.TmdbDataRepository;
import com.db.dbworld.dao.dbcinema.user.UserRecordDataRepository;
import com.db.dbworld.entities.dbcinema.DBCinemaRecordsEntity;
import com.db.dbworld.entities.dbcinema.tmdb.*;
import com.db.dbworld.entities.dbcinema.tmdb.credits.CharacterEntity;
import com.db.dbworld.entities.dbcinema.tmdb.credits.DepartmentEntity;
import com.db.dbworld.entities.dbcinema.tmdb.credits.JobEntity;
import com.db.dbworld.entities.dbcinema.tmdb.credits.PersonEntity;
import com.db.dbworld.entities.dbcinema.user.UserRecordDataEntity;
import com.db.dbworld.entities.user.UserEntity;
import com.db.dbworld.exceptions.DbWorldException;
import com.db.dbworld.exceptions.DuplicateResourceException;
import com.db.dbworld.exceptions.ResourceNotFoundException;
import com.db.dbworld.exceptions.TmdbApiException;
import com.db.dbworld.payloads.RequestPayloads;
import com.db.dbworld.payloads.ResponsePayloads;
import com.db.dbworld.payloads.dbcinema.DBCinemaRecordsDto;
import com.db.dbworld.payloads.dbcinema.tmdb.GenresDto;
import com.db.dbworld.payloads.dbcinema.tmdb.MovieTmdbDataDto;
import com.db.dbworld.payloads.dbcinema.tmdb.SeriesTmdbDataDto;
import com.db.dbworld.services.DBCinemaRecordsService;
import com.db.dbworld.services.UserService;
import com.db.dbworld.utils.DbWorldConstants;
import com.db.dbworld.utils.DbWorldUtils;
import com.db.dbworld.utils.PojoConverter;
import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import lombok.extern.log4j.Log4j2;
import org.modelmapper.ModelMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.CacheConfig;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.security.authentication.AuthenticationServiceException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.RestTemplate;

import java.util.*;
import java.util.stream.Collectors;


@Service
@Log4j2
@EnableAsync
@CacheConfig(cacheNames = "DB-Cinema")
public class DBCinemaRecordsServiceImpl implements DBCinemaRecordsService {

    @Autowired
    private RestTemplate restTemplate;

    @Autowired
    private DbWorldUtils dbWorldUtils;

    @Autowired
    private ModelMapper modelMapper;

    @Autowired
    private DBCinemaRecordsRepository dbCinemaRecordsRepository;

    @Autowired
    private TmdbDataRepository tmdbDataRepository;

    @Autowired
    private UserRecordDataRepository userRecordDataRepository;

    @Autowired
    private GenresRepository genresRepository;

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private PojoConverter pojoConverter;

    private static final String SEARCH_RECORD_BY_KEYWORD = "SELECT dcr FROM DBCinemaRecordsEntity dcr WHERE dcr.name LIKE (:keyword) OR dcr.tmdb.original_title LIKE (:keyword) ORDER BY dcr.creationDate DESC";
    private static final String ALL_LANGUAGES = "all";

    @Autowired
    private UserService userService;

    private Map<String, Object> updateRecordsFromTmdb = new HashMap<>();

    public boolean isRecordsUpdatingFromTmdb = false;

    @Transactional
    @Override
    @CacheEvict(cacheNames = "DB-Cinema::DBCinemaRecordsServiceImpl", allEntries = true)
    public DBCinemaRecordsDto addRecord(RequestPayloads.AddRecord record) {
        if (this.dbCinemaRecordsRepository.findByTmdbId(record.getTmdbId()).isEmpty()) {
            try {
                DBCinemaRecordsEntity dbCinemaRecordsEntity = new DBCinemaRecordsEntity();
                dbCinemaRecordsEntity.setType(record.getType().toLowerCase());

                if (record.getType().equalsIgnoreCase(DbWorldConstants.RECORD_TYPE_MOVIE)) {
                    MovieTmdbDataDto movieTmdbDataDto = getTMDBDetailsForMovieById(record);
                    dbCinemaRecordsEntity.setName(movieTmdbDataDto.getTitle());
                    dbCinemaRecordsEntity.setTmdb(mergeTmdbEntity(pojoConverter.movieTmdbDtoToEntity(movieTmdbDataDto, new MovieTmdbDataEntity())));
                } else if (record.getType().equalsIgnoreCase(DbWorldConstants.RECORD_TYPE_SERIES)) {
                    SeriesTmdbDataDto seriesTmdbDataDto = getTMDBDetailsForSeriesById(record);
                    dbCinemaRecordsEntity.setName(seriesTmdbDataDto.getTitle());
                    dbCinemaRecordsEntity.setTmdb(mergeTmdbEntity(pojoConverter.seriesTmdbDtoToEntity(seriesTmdbDataDto, new SeriesTmdbDataEntity())));
                }
                DBCinemaRecordsEntity newDbCinemaRecordEntity = entityManager.merge(dbCinemaRecordsEntity);
                return pojoConverter.dbCinemaRecordsEntityToDto(newDbCinemaRecordEntity);
            } catch (Exception ex) {
                log.error(ex);
                throw new DbWorldException(ex.getMessage());
            }
        } else {
            throw new DuplicateResourceException("DBCinemaRecordsEntity", "tmdbId", Long.toString(record.getTmdbId()));
        }
    }

    @Transactional
    @Override
    @CacheEvict(cacheNames = "DB-Cinema::DBCinemaRecordsServiceImpl", allEntries = true)
    public DBCinemaRecordsDto updateRecord(Long recordId, RequestPayloads.AddRecord record) {
        try {
            TmdbDataEntity tmdbDataEntity = null;
            DBCinemaRecordsEntity dbCinemaRecordsEntity = dbCinemaRecordsRepository.findById(recordId).orElseThrow(
                    () -> new ResourceNotFoundException("DB Cinema Record", "record id", recordId.toString())
            );
            if (record.getTmdbId() != dbCinemaRecordsEntity.getTmdb().getId()) {
                throw new DbWorldException(HttpStatus.BAD_REQUEST, "Tmdb Id is different from existing.");
            }
            if (record.getType().equalsIgnoreCase(DbWorldConstants.RECORD_TYPE_MOVIE)) {
                tmdbDataEntity = updateTmdbForMovie(dbCinemaRecordsEntity.getTmdb());
            } else if (record.getType().equalsIgnoreCase(DbWorldConstants.RECORD_TYPE_SERIES)) {
                tmdbDataEntity = updateTmdbForSeries(dbCinemaRecordsEntity.getTmdb());
            } else {
                throw new ResourceNotFoundException("Db Cinema Record", "record type", record.getType());
            }
            dbCinemaRecordsEntity.setTmdb(tmdbDataEntity);
            dbCinemaRecordsEntity.setName(Objects.requireNonNull(tmdbDataEntity).getTitle());
            dbCinemaRecordsEntity.setShowOnTop(record.isShowOnTop());
            DBCinemaRecordsEntity newDbCinemaRecordsEntity = entityManager.merge(dbCinemaRecordsEntity);
            return pojoConverter.dbCinemaRecordsEntityToDto(newDbCinemaRecordsEntity);
        } catch (Exception ex) {
            log.error(ex);
            throw new DbWorldException(ex.getMessage());
        }
    }

    @Override
    @Transactional
    @CacheEvict(cacheNames = "DB-Cinema::DBCinemaRecordsServiceImpl", allEntries = true)
    public void deleteRecord(Long recordId) {
        if (this.dbCinemaRecordsRepository.existsById(recordId)) {
            this.userRecordDataRepository.deleteByDbCinemaRecordId(recordId);
            this.dbCinemaRecordsRepository.deleteById(recordId);
        } else {
            throw new ResourceNotFoundException("db_cinema_record", "id", recordId.toString());
        }
    }

    @Override
    public List<DBCinemaRecordsDto> getRecords() {
        return List.of();
    }

    @Override
    @Cacheable(keyGenerator = DbWorldConstants.CUSTOM_REDIS_KEY_GENERATOR)
    public List<DBCinemaRecordsDto> fetchDbCinemaRecords(String recordType, Pageable pageable, String languages, String genres) {
        Long userId = userService.getUserIdFromToken();
        Integer[] genresArray = null;
        if (genres != null) {
            List<Integer> list = Arrays.stream(genres.split(",")).map(Integer::parseInt).toList();
            genresArray = new Integer[list.size()];
            genresArray = list.toArray(genresArray);
        }
        if (languages != null && genresArray != null) {
            return dbCinemaRecordsRepository.findRecords(userId, recordType, genresArray, languages.split(","), pageable)
                    .stream().map(dbCinemaRecordsEntity -> pojoConverter.dbCinemaRecordsEntityToDto(dbCinemaRecordsEntity))
                    .collect(Collectors.toList());
        } else if (languages == null && genresArray != null) {
            return dbCinemaRecordsRepository.findRecords(userId, recordType, genresArray, pageable)
                    .stream().map(dbCinemaRecordsEntity -> pojoConverter.dbCinemaRecordsEntityToDto(dbCinemaRecordsEntity))
                    .collect(Collectors.toList());
        } else if (languages != null) {
            return dbCinemaRecordsRepository.findRecords(userId, recordType, languages.split(","), pageable)
                    .stream().map(dbCinemaRecordsEntity -> pojoConverter.dbCinemaRecordsEntityToDto(dbCinemaRecordsEntity))
                    .collect(Collectors.toList());
        } else {
            return dbCinemaRecordsRepository.findRecords(userId, recordType, pageable)
                    .stream().map(dbCinemaRecordsEntity -> pojoConverter.dbCinemaRecordsEntityToDto(dbCinemaRecordsEntity))
                    .collect(Collectors.toList());
        }
    }

    @Override
    @Cacheable(keyGenerator = DbWorldConstants.CUSTOM_REDIS_KEY_GENERATOR)
    public Integer fetchCountOfDbCinemaRecords(String recordType, String languages, String genres) {
        Integer[] genresArray = null;
        Integer totalElement = null;
        if (genres != null) {
            List<Integer> list = Arrays.stream(genres.split(",")).map(Integer::parseInt).toList();
            genresArray = new Integer[list.size()];
            genresArray = list.toArray(genresArray);
        }
        if (languages != null && genresArray != null) {
            totalElement = dbCinemaRecordsRepository.countRecords( recordType, genresArray, languages.split(",") )
                    .orElse(0L).intValue();
        } else if (languages == null && genresArray != null) {
            totalElement = dbCinemaRecordsRepository.countRecords(recordType, genresArray).orElse(0L).intValue();
        } else if (languages != null) {
            totalElement = dbCinemaRecordsRepository.countRecords(recordType, languages.split(",")).orElse(0L).intValue();
        } else {
            totalElement = dbCinemaRecordsRepository.countRecords(recordType).orElse(0L).intValue();
        }
        return totalElement;
    }


    @Override
    @Cacheable(keyGenerator = "addUsersDbCinemaDataKey")
    public DBCinemaRecordsDto addUsersDbCinemaData(DBCinemaRecordsDto dbCinemaRecordsDto) {
        Long userId = this.userService.getUserIdFromToken();
        UserRecordDataEntity userRecordDataEntity = userRecordDataRepository.findByUserUserIdAndDbCinemaRecordId(userId, dbCinemaRecordsDto.getRecordId()).orElse(null);
        dbCinemaRecordsDto.setWatchListed(userRecordDataEntity != null && userRecordDataEntity.isWatchListed());
        dbCinemaRecordsDto.setLiked(userRecordDataEntity != null && userRecordDataEntity.isLiked());
        dbCinemaRecordsDto.setWatched(userRecordDataEntity != null && userRecordDataEntity.isWatched());
        return dbCinemaRecordsDto;
    }

    @Override
    public DBCinemaRecordsDto getRecordById(Long recordId) {
        DBCinemaRecordsEntity dbCinemaRecordsEntity = getRecordEntityById(recordId);
        return pojoConverter.dbCinemaRecordsEntityToDto(addUsersDbCinemaData(dbCinemaRecordsEntity));
    }

    @Override
    public DBCinemaRecordsEntity getRecordEntityById(Long recordId) {
        return dbCinemaRecordsRepository.findById(recordId).orElseThrow(
                () -> new ResourceNotFoundException("DB Cinema Record", "record id", recordId.toString())
        );
    }

    @Override
    public List<DBCinemaRecordsDto> searchRecordByKeywordWithUserData(String keyword) {
        try {
            TypedQuery<DBCinemaRecordsEntity> query = entityManager.createQuery(SEARCH_RECORD_BY_KEYWORD, DBCinemaRecordsEntity.class);
            query.setParameter("keyword", "%" + keyword + "%");
            List<DBCinemaRecordsEntity> dbCinemaRecordsEntities = query.getResultList();
            return dbCinemaRecordsEntities.stream().map(
                    dbCinemaRecordsEntity -> this.pojoConverter.dbCinemaRecordsEntityToDto(addUsersDbCinemaData(dbCinemaRecordsEntity))
            ).toList();
        } catch (Exception ex) {
            throw new DbWorldException(ex.getMessage());
        }
    }

    @Override
    public List<Map<String, String>> searchRecordByKeyword(String keyword) {
        try {
            return dbCinemaRecordsRepository.findRecords("%" + keyword + "%");
        } catch (Exception ex) {
            throw new DbWorldException(ex.getMessage());
        }
    }

    @Override
    @Transactional
    @CacheEvict(keyGenerator = "addUsersDbCinemaDataKey")
    public DBCinemaRecordsDto userRecordDataProcess(Long recordId, String process) {
        try {
            if (process.equalsIgnoreCase(DbWorldConstants.PROCESS_UN_LIKE)) {
                this.userRecordDataRepository.setIsLikeAsFalseByUserIdRecordId(this.userService.getUserIdFromToken(), recordId);
            } else if (process.equalsIgnoreCase(DbWorldConstants.PROCESS_UN_WATCH)) {
                this.userRecordDataRepository.setIsWatchAsFalseByUserIdRecordId(this.userService.getUserIdFromToken(), recordId);
            } else if (process.equalsIgnoreCase(DbWorldConstants.PROCESS_UN_WATCHLIST)) {
                this.userRecordDataRepository.setIsWatchListedAsFalseByUserIdRecordId(this.userService.getUserIdFromToken(), recordId);
            } else if (process.equalsIgnoreCase(DbWorldConstants.PROCESS_LIKE)
                    || process.equalsIgnoreCase(DbWorldConstants.PROCESS_WATCH)
                    || process.equalsIgnoreCase(DbWorldConstants.PROCESS_WATCHLIST)) {
                UserEntity userEntity = this.userService.getUserFromToken();
                UserRecordDataEntity userRecordDataEntity = this.userRecordDataRepository
                        .findByUserUserIdAndDbCinemaRecordId(userEntity.getUserId(), recordId)
                        .orElseGet(() -> {
                            UserRecordDataEntity newUserRecordDataEntity = new UserRecordDataEntity();
                            newUserRecordDataEntity.setDbCinemaRecord(getRecordEntityById(recordId));
                            newUserRecordDataEntity.setUser(userEntity);
                            return newUserRecordDataEntity;
                        });
                if (process.equalsIgnoreCase(DbWorldConstants.PROCESS_LIKE)) {
                    userRecordDataEntity.setLiked(true);
                } else if (process.equalsIgnoreCase(DbWorldConstants.PROCESS_WATCH)) {
                    userRecordDataEntity.setWatched(true);
                } else if (process.equalsIgnoreCase(DbWorldConstants.PROCESS_WATCHLIST)) {
                    userRecordDataEntity.setWatchListed(true);
                }
                this.userRecordDataRepository.save(userRecordDataEntity);
            }
            return getRecordById(recordId);
        } catch (Exception ex) {
            throw new DbWorldException(ex.getMessage());
        }
    }

    @Override
    public List<DBCinemaRecordsDto> getWatchListCinemaRecords() {
        try {
            List<DBCinemaRecordsEntity> dbCinemaRecordsEntities = this.dbCinemaRecordsRepository
                    .findUserWatchListCinemaRecords(this.userService.getUserFromToken().getUserId());
            if (dbCinemaRecordsEntities == null) {
                dbCinemaRecordsEntities = new ArrayList<>();
            }
            return dbCinemaRecordsEntities.stream().map(
                    dbCinemaRecordsEntity -> this.pojoConverter.dbCinemaRecordsEntityToDto(addUsersDbCinemaData(dbCinemaRecordsEntity))
            ).toList();
        } catch (AuthenticationException ex) {
            throw new AuthenticationServiceException("Token is not valid. Please do login again.");
        } catch (Exception ex) {
            throw new DbWorldException(ex.getMessage());
        }
    }

    @Async
    @Override
    @Transactional
    public void updateTmdbWithLatest() {
        try {
            updateRecordsFromTmdb = new HashMap<>();
            updateRecordsFromTmdb.put("start_time", dbWorldUtils.getISTDateTime().toLocalDateTime().toString());
            updateRecordsFromTmdb.put("running", true);

            List<TmdbDataEntity> tmdbDataEntities = tmdbDataRepository.findAll();
            Map<Long, String> failedIds = new HashMap<>();
            List<Long> successIds = new ArrayList<>();
            tmdbDataEntities.forEach(tmdbDataEntity -> {
                try {
                    if (tmdbDataEntity instanceof MovieTmdbDataEntity) {
                        updateTmdbForMovie(tmdbDataEntity);
                    } else if (tmdbDataEntity instanceof SeriesTmdbDataEntity) {
                        updateTmdbForSeries(tmdbDataEntity);
                    }
                    successIds.add(tmdbDataEntity.getId());
                    updateRecordsFromTmdb.put("success", successIds);
                    log.info("Success TMDB ID: {}", tmdbDataEntity.getId());
                    Thread.sleep(200);
                } catch (Exception ex) {
                    failedIds.put(tmdbDataEntity.getId(), ex.getMessage());
                    updateRecordsFromTmdb.put("failed", failedIds);
                    log.error("Failed ID: {} Error Message: {}", tmdbDataEntity.getId(), ex.getMessage());
                }
            });
        } catch (Exception ex) {
            throw new DbWorldException(ex.getMessage(), updateRecordsFromTmdb);
        } finally {
            updateRecordsFromTmdb.put("end_time", dbWorldUtils.getISTDateTime().toLocalDateTime().toString());
            updateRecordsFromTmdb.put("running", false);
        }
    }

    private TmdbDataEntity updateTmdbForSeries(TmdbDataEntity tmdbDataEntity) {
        SeriesTmdbDataDto seriesTmdbDataDto = getTMDBDetailsForSeriesById(new RequestPayloads.AddRecord(
                tmdbDataEntity.getTitle(), tmdbDataEntity.getId(), DbWorldConstants.RECORD_TYPE_SERIES, false
        ));
        return mergeTmdbEntity(pojoConverter.seriesTmdbDtoToEntity(seriesTmdbDataDto, (SeriesTmdbDataEntity) tmdbDataEntity));
    }

    private TmdbDataEntity updateTmdbForMovie(TmdbDataEntity tmdbDataEntity) {
        MovieTmdbDataDto movieTmdbDataDto = getTMDBDetailsForMovieById(new RequestPayloads.AddRecord(
                tmdbDataEntity.getTitle(), tmdbDataEntity.getId(), DbWorldConstants.RECORD_TYPE_MOVIE, false
        ));
        return mergeTmdbEntity(pojoConverter.movieTmdbDtoToEntity(movieTmdbDataDto, (MovieTmdbDataEntity) tmdbDataEntity));
    }

    @Override
    public Map<String, Object> getStatusOfRecordsUpdate() {
        return updateRecordsFromTmdb;
    }

    @Override
    public boolean isRecordsUpdateRunning() {
        return updateRecordsFromTmdb.containsKey("running") && (Boolean) updateRecordsFromTmdb.get("running");
    }

    @Override
    @Cacheable(keyGenerator = DbWorldConstants.CUSTOM_REDIS_KEY_GENERATOR)
    public List<GenresDto> getAllGenres() {
        List<GenresEntity> genresEntities = genresRepository.findAll(Sort.by("name").ascending());
        return genresEntities.stream().map(genresEntity -> this.modelMapper.map(genresEntity, GenresDto.class)).collect(Collectors.toList());
    }

    @Override
    public List<HashMap<String, Object>> getTmdbByQuery(String recordType, String query, int year) {
        ResponseEntity<String> response = null;
        List<HashMap<String, Object>> tmdbSearchList = new ArrayList<>();
        try {
            response = restTemplate.getForEntity(dbWorldUtils.getTMDBByQueryUrl(recordType, query, year), String.class);
            String tmdbRecords = response.getBody();
            JsonObject tmdbRecordsJson = new Gson().fromJson(tmdbRecords, JsonObject.class);
            if (tmdbRecordsJson.getAsJsonPrimitive("total_results").getAsInt() != 0) {
                JsonArray tmdbArray = tmdbRecordsJson.getAsJsonArray("results");
                tmdbArray.forEach(jsonElement -> {
                    JsonObject jsonObject = jsonElement.getAsJsonObject();
                    HashMap<String, Object> hashMap = new HashMap<>();
                    hashMap.put("id", jsonObject.get("id"));
                    hashMap.put("title", jsonObject.get(recordType.equalsIgnoreCase(DbWorldConstants.RECORD_TYPE_MOVIE) ? "title" : "name"));
                    hashMap.put("originalTitle", jsonObject.get(recordType.equalsIgnoreCase(DbWorldConstants.RECORD_TYPE_MOVIE) ? "original_title" : "original_name"));
                    hashMap.put("releaseDate", jsonObject.get(recordType.equalsIgnoreCase(DbWorldConstants.RECORD_TYPE_MOVIE) ? "release_date" : "first_air_date"));
                    hashMap.put("overview", jsonObject.get("overview"));
                    tmdbSearchList.add(hashMap);
                });
            }
        } catch (HttpClientErrorException | HttpServerErrorException ex) {
            ResponsePayloads.TmdbFilerResponse tmdbFilerResponse = new Gson().fromJson(ex.getResponseBodyAsString(), ResponsePayloads.TmdbFilerResponse.class);
            throw new TmdbApiException(null, tmdbFilerResponse.getStatus_message(), ex.getStatusCode());
        }
        return tmdbSearchList;
    }

    @Override
    public MovieTmdbDataDto getTMDBDetailsForMovieById(RequestPayloads.AddRecord record) {
        JsonObject recordDetailsJson = getRecordDetailsFromTmdbApi(record);
        return new Gson().fromJson(recordDetailsJson, MovieTmdbDataDto.class);
    }

    @Override
    public SeriesTmdbDataDto getTMDBDetailsForSeriesById(RequestPayloads.AddRecord record) {
        JsonObject recordDetailsJson = getRecordDetailsFromTmdbApi(record);
        return new Gson().fromJson(recordDetailsJson, SeriesTmdbDataDto.class);
    }

    @Transactional
    private TmdbDataEntity mergeTmdbEntity(TmdbDataEntity tmdbDataEntity) {

        if (tmdbDataEntity.getSpoken_languages() != null) {
            tmdbDataEntity.getSpoken_languages().forEach(
                    spokenLanguageEntity -> {
                        SpokenLanguageEntity spokenLanguage = entityManager.find(SpokenLanguageEntity.class, spokenLanguageEntity.getIso_639_1());
                        if (spokenLanguage == null) {
                            entityManager.persist(spokenLanguageEntity);
                        } else {
                            entityManager.merge(spokenLanguageEntity);
                        }
                    }
            );
        }

        if (tmdbDataEntity.getProduction_countries() != null) {
            tmdbDataEntity.getProduction_countries().forEach(
                    productionCountriesEntity -> {
                        ProductionCountriesEntity productionCountries = entityManager.find(ProductionCountriesEntity.class, productionCountriesEntity.getIso_3166_1());
                        if (productionCountries == null) {
                            entityManager.persist(productionCountriesEntity);
                        } else {
                            entityManager.merge(productionCountriesEntity);
                        }
                    }
            );
        }

        if (tmdbDataEntity.getProduction_companies() != null) {
            tmdbDataEntity.getProduction_companies().forEach(
                    productionCompaniesEntity -> {
                        ProductionCompaniesEntity productionCountries = entityManager.find(ProductionCompaniesEntity.class, productionCompaniesEntity.getId());
                        if (productionCountries == null) {
                            entityManager.persist(productionCompaniesEntity);
                        } else {
                            entityManager.merge(productionCompaniesEntity);
                        }
                    }
            );
        }

        if (tmdbDataEntity.getVideos() != null) {
            tmdbDataEntity.getVideos().forEach(videosEntity -> {
                if (videosEntity.getIso_3166_1() != null) {
                    ProductionCountriesEntity productionCountries = entityManager.find(ProductionCountriesEntity.class, videosEntity.getIso_3166_1().getIso_3166_1());
                    if (productionCountries == null) {
                        entityManager.persist(videosEntity.getIso_3166_1());
                    } else {
                        entityManager.merge(videosEntity.getIso_3166_1());
                    }
                }
                if (videosEntity.getIso_639_1() != null) {
                    SpokenLanguageEntity spokenLanguage = entityManager.find(SpokenLanguageEntity.class, videosEntity.getIso_639_1().getIso_639_1());
                    if (spokenLanguage == null) {
                        entityManager.persist(videosEntity.getIso_639_1());
                    } else {
                        entityManager.merge(videosEntity.getIso_639_1());
                    }
                }
            });
        }

        if (tmdbDataEntity.getImages() != null) {
            tmdbDataEntity.getImages().forEach(imagesEntity -> {
                if (imagesEntity.getIso_639_1() != null) {
                    SpokenLanguageEntity spokenLanguage = entityManager.find(SpokenLanguageEntity.class, imagesEntity.getIso_639_1().getIso_639_1());
                    if (spokenLanguage == null) {
                        entityManager.persist(imagesEntity.getIso_639_1());
                    } else {
                        entityManager.merge(imagesEntity.getIso_639_1());
                    }
                }
            });
        }

        if (tmdbDataEntity.getCredits() != null) {
            if (tmdbDataEntity.getCredits().getCrew() != null) {
                tmdbDataEntity.getCredits().getCrew().forEach(crew -> {
                    PersonEntity person = entityManager.find(PersonEntity.class, crew.getPerson().getId());
                    if (person == null) {
                        entityManager.persist(crew.getPerson());
                    } else {
                        entityManager.merge(person);
                    }
                    DepartmentEntity department = entityManager.find(DepartmentEntity.class, crew.getDepartment().getName());
                    if (department == null) {
                        entityManager.persist(crew.getDepartment());
                    }
                    JobEntity job = entityManager.find(JobEntity.class, crew.getJob().getName());
                    if (job == null) {
                        entityManager.persist(crew.getJob());
                    }
                });
            }
            if (tmdbDataEntity.getCredits().getCast() != null) {
                tmdbDataEntity.getCredits().getCast().forEach(cast -> {
                    PersonEntity person = entityManager.find(PersonEntity.class, cast.getPerson().getId());
                    if (person == null) {
                        entityManager.persist(cast.getPerson());
                    }
                    CharacterEntity character = entityManager.find(CharacterEntity.class, cast.getCharacter().getName());
                    if (character == null) {
                        entityManager.persist(cast.getCharacter());
                    }
                });
            }
        }

        return entityManager.merge(tmdbDataEntity);
    }

    private DBCinemaRecordsEntity addUsersDbCinemaData(DBCinemaRecordsEntity dbCinemaRecordsEntity) {
        Long userId = this.userService.getUserIdFromToken();
        UserRecordDataEntity userRecordDataEntity = userRecordDataRepository.findByUserUserIdAndDbCinemaRecordId(userId, dbCinemaRecordsEntity.getId()).orElse(null);
        dbCinemaRecordsEntity.setWatchListed(userRecordDataEntity != null && userRecordDataEntity.isWatchListed());
        dbCinemaRecordsEntity.setLiked(userRecordDataEntity != null && userRecordDataEntity.isLiked());
        dbCinemaRecordsEntity.setWatched(userRecordDataEntity != null && userRecordDataEntity.isWatched());
        return dbCinemaRecordsEntity;
    }

    private JsonObject getRecordDetailsFromTmdbApi(RequestPayloads.AddRecord record) {

        ResponseEntity<String> recordDetailsResponse;
        ResponseEntity<String> recordProviderResponse = null;
        try {
            recordDetailsResponse = restTemplate.getForEntity(dbWorldUtils.getTMDBRecordDetailsUrl(record), String.class);
        } catch (HttpClientErrorException | HttpServerErrorException ex) {
            ResponsePayloads.TmdbFilerResponse tmdbFilerResponse = new Gson().fromJson(ex.getResponseBodyAsString(), ResponsePayloads.TmdbFilerResponse.class);
            throw new TmdbApiException(record.getTmdbId(), tmdbFilerResponse.getStatus_message(), ex.getStatusCode());
        }

        try {
            recordProviderResponse = restTemplate.getForEntity(dbWorldUtils.getTMDBRecordProviderUrl(record), String.class);
        } catch (HttpClientErrorException | HttpServerErrorException ex) {
            ResponsePayloads.TmdbFilerResponse tmdbFilerResponse = new Gson().fromJson(ex.getResponseBodyAsString(), ResponsePayloads.TmdbFilerResponse.class);
            log.error("Error while getting tmdb provider details. Error: {}", tmdbFilerResponse.getStatus_message());
        }

        return modifyTmdbJson(recordDetailsResponse.getBody(), recordProviderResponse == null ? null : recordProviderResponse.getBody(), record.getType());
    }

    private JsonObject modifyTmdbJson(String recordDetailsResponse, String recordProviderResponse, String recordType) {
        //Getting Record Details and modifying "videos" object
        JsonObject recordDetailsJson = new Gson().fromJson(Objects.requireNonNull(recordDetailsResponse), JsonObject.class);
        JsonElement videosJsonElement = recordDetailsJson.getAsJsonObject(DbWorldConstants.TMDB_VIDEOS_PROPERTY_KEY)
                .get(DbWorldConstants.TMDB_RESULTS_PROPERTY_KEY);
        recordDetailsJson.add(DbWorldConstants.TMDB_VIDEOS_PROPERTY_KEY, videosJsonElement);

        //Getting Record's ott provider and adding in record details Json Object
        JsonObject inKeyJsonObject = new Gson().fromJson(Objects.requireNonNull(recordProviderResponse), JsonObject.class)
                .getAsJsonObject(DbWorldConstants.TMDB_RESULTS_PROPERTY_KEY)
                .getAsJsonObject(DbWorldConstants.TMDB_IN_PROPERTY_KEY);

        if (inKeyJsonObject != null && (!inKeyJsonObject.isJsonNull() || !inKeyJsonObject.isEmpty())) {
            JsonObject providersJsonObject = new JsonObject();
            providersJsonObject.add(DbWorldConstants.TMDB_RENT_PROPERTY_KEY, inKeyJsonObject.get(DbWorldConstants.TMDB_RENT_PROPERTY_KEY));
            providersJsonObject.add(DbWorldConstants.TMDB_BUY_PROPERTY_KEY, inKeyJsonObject.get(DbWorldConstants.TMDB_BUY_PROPERTY_KEY));
            providersJsonObject.add(DbWorldConstants.TMDB_FLATRATE_PROPERTY_KEY, inKeyJsonObject.get(DbWorldConstants.TMDB_FLATRATE_PROPERTY_KEY));

            recordDetailsJson.add(DbWorldConstants.PROVIDERS_PROPERTY_KEY, providersJsonObject);
        }

        //If it's Series then have to modify some properties
        if (recordType.equalsIgnoreCase(DbWorldConstants.RECORD_TYPE_SERIES)) {
            recordDetailsJson.add(DbWorldConstants.TMDB_TITLE_PROPERTY_KEY, recordDetailsJson.get(DbWorldConstants.TMDB_NAME_PROPERTY_KEY));
            recordDetailsJson.add(DbWorldConstants.TMDB_ORIGINAL_TITLE_PROPERTY_KEY, recordDetailsJson.get(DbWorldConstants.TMDB_ORIGINAL_NAME_PROPERTY_KEY));
        }
        return recordDetailsJson;
    }

}
