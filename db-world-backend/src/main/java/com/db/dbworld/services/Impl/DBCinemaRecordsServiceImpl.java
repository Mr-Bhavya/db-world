package com.db.dbworld.services.Impl;

import com.db.dbworld.dao.dbcinema.DBCinemaRecordsRepository;
import com.db.dbworld.dao.dbcinema.tmdb.TmdbDataRepository;
import com.db.dbworld.dao.dbcinema.user.UserLikedRecordRepository;
import com.db.dbworld.dao.dbcinema.user.UserWatchlistRecordRepository;
import com.db.dbworld.entities.dbcinema.DBCinemaRecordsEntity;
import com.db.dbworld.entities.dbcinema.tmdb.*;
import com.db.dbworld.entities.dbcinema.tmdb.credits.CreditsEntity;
import com.db.dbworld.entities.dbcinema.tmdb.providers.ProvidersEntity;
import com.db.dbworld.entities.dbcinema.user.UserLikeRecordEntity;
import com.db.dbworld.entities.dbcinema.user.UserWatchlistRecordEntity;
import com.db.dbworld.entities.user.UserEntity;
import com.db.dbworld.exceptions.DbWorldException;
import com.db.dbworld.exceptions.DuplicateResourceException;
import com.db.dbworld.exceptions.ResourceNotFoundException;
import com.db.dbworld.exceptions.TmdbApiException;
import com.db.dbworld.payloads.RequestPayloads;
import com.db.dbworld.payloads.ResponsePayloads;
import com.db.dbworld.payloads.dbcinema.DBCinemaRecordsDto;
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
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationServiceException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.RestTemplate;

import java.util.*;

@Service
@Log4j2
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
    private UserLikedRecordRepository userLikedRecordRepository;

    @Autowired
    private UserWatchlistRecordRepository userWatchlistRecordRepository;
    @Autowired
    private EntityManager entityManager;

    @Autowired
    private PojoConverter pojoConverter;
    private static final String SEARCH_RECORD_BY_KEYWORD = "SELECT dcr FROM DBCinemaRecordsEntity dcr WHERE dcr.name LIKE (:keyword) OR dcr.tmdb.original_title LIKE (:keyword) ORDER BY dcr.creationDate DESC";
    private static final String ALL_LANGUAGES = "all";

    @Autowired
    private UserService userService;

    private Map<String, Long> updateRecordsStatus = new HashMap<>();

    public boolean isRecordsUpdateRunning = false;

    @Transactional
    @Override
    public DBCinemaRecordsDto addRecord(RequestPayloads.AddRecord record) {
        if (this.dbCinemaRecordsRepository.findByTmdbId(record.getTmdbId()).isEmpty()) {
            try {
                DBCinemaRecordsEntity dbCinemaRecordsEntity = new DBCinemaRecordsEntity();
                dbCinemaRecordsEntity.setType(record.getType().toLowerCase());

                if (record.getType().equalsIgnoreCase(DbWorldConstants.RECORD_TYPE_MOVIE)) {
                    MovieTmdbDataDto movieTmdbDataDto = getTMDBDetailsForMovieById(record);
                    dbCinemaRecordsEntity.setName(movieTmdbDataDto.getTitle());
                    pojoConverter.movieTmdbDtoToEntity(movieTmdbDataDto, new MovieTmdbDataEntity());
                    dbCinemaRecordsEntity.setTmdb(mergeTmdbEntity(pojoConverter.movieTmdbDtoToEntity(movieTmdbDataDto, new MovieTmdbDataEntity())));
                } else if (record.getType().equalsIgnoreCase(DbWorldConstants.RECORD_TYPE_SERIES)) {
                    SeriesTmdbDataDto seriesTmdbDataDto = getTMDBDetailsForSeriesById(record);
                    dbCinemaRecordsEntity.setName(seriesTmdbDataDto.getTitle());
                    dbCinemaRecordsEntity.setTmdb(mergeTmdbEntity(dbWorldUtils.convertSeriesTmdbDtoToEntity(seriesTmdbDataDto)));
                }
                DBCinemaRecordsEntity newDbCinemaRecordEntity = entityManager.merge(dbCinemaRecordsEntity);
                return dbWorldUtils.convertDbCinemaRecordEntityToDto(newDbCinemaRecordEntity);
            } catch (Exception ex) {
                ex.printStackTrace();
                throw new DbWorldException(ex.getMessage());
            }finally {
//                entityManager.flush();
//                entityManager.clear();
//                entityManager.close();
            }
        } else {
            throw new DuplicateResourceException("DBCinemaRecordsEntity", "tmdbId", Long.toString(record.getTmdbId()));
        }
    }

    @Transactional
    @Override
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
            DBCinemaRecordsEntity newDbCinemaRecordsEntity = entityManager.merge(dbCinemaRecordsEntity);
            return dbWorldUtils.convertDbCinemaRecordEntityToDto(newDbCinemaRecordsEntity);
        } catch (Exception ex) {
            ex.printStackTrace();
            log.error(ex);
            throw new DbWorldException(ex.getMessage());
        }finally {
//            entityManager.flush();
//            entityManager.clear();
//            entityManager.close();
        }
    }

    @Override
    @Transactional
    public void deleteRecord(Long recordId) {
        if (this.dbCinemaRecordsRepository.existsById(recordId)) {
            this.userWatchlistRecordRepository.deleteByDbCinemaRecordId(recordId);
            this.userLikedRecordRepository.deleteByDbCinemaRecordId(recordId);
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
    public PageImpl<DBCinemaRecordsDto> getRecordsByPagination(String recordType, int pageNumber, int pageSize, String languages) {

        try {
            Long userId = userService.getUserIdFromToken();
            Pageable pageable = PageRequest.of(pageNumber, pageSize, Sort.by("creationDate").descending());

            List<DBCinemaRecordsEntity> dbCinemaRecordsEntities = languages.equalsIgnoreCase(ALL_LANGUAGES) ?
                    dbCinemaRecordsRepository.findRecordsByUserAndType(userId, recordType, pageable)
                    :
                    dbCinemaRecordsRepository.findRecordsByUserAndTypeAndLanguages(userId, recordType, Arrays.stream(languages.split(",")).toList(), pageable);

            Long totalElements = languages.equalsIgnoreCase(ALL_LANGUAGES) ?
                    dbCinemaRecordsRepository.countRecordsByType(recordType).orElse(0L)
                    :
                    dbCinemaRecordsRepository.countRecordsByTypeAndLanguages(recordType, Arrays.stream(languages.split(",")).toList()).orElse(0L);


            List<DBCinemaRecordsDto> dbCinemaRecordsDtos = dbCinemaRecordsEntities.stream().map(dbCinemaRecordsEntity -> {
                dbCinemaRecordsEntity.setWatchListed(
                        this.userWatchlistRecordRepository.isRecordWatchListedByUser(userId, dbCinemaRecordsEntity.getId()).orElse(false)
                );
                dbCinemaRecordsEntity.setLiked(
                        this.userLikedRecordRepository.isRecordLikedByUser(userId, dbCinemaRecordsEntity.getId()).orElse(false)
                );
                return dbWorldUtils.convertDbCinemaRecordEntityToDto(dbCinemaRecordsEntity);
            }).toList();

            return new PageImpl<>(dbCinemaRecordsDtos,pageable,totalElements);
        } catch (AuthenticationException ex) {
            throw new AuthenticationServiceException(DbWorldConstants.AUTHENTICATION_EXCEPTION_MESSAGE);
        } catch (Exception ex) {
            throw new DbWorldException(ex.getMessage());
        }
    }

    @Override
    public DBCinemaRecordsDto getRecordById(Long recordId) {
        DBCinemaRecordsEntity dbCinemaRecordsEntity = dbCinemaRecordsRepository.findById(recordId).orElseThrow(
                () -> new ResourceNotFoundException("DB Cinema Record", "record id", recordId.toString())
        );
        return dbWorldUtils.convertDbCinemaRecordEntityToDto(dbCinemaRecordsEntity);
    }

    @Override
    public DBCinemaRecordsEntity getRecordEntityById(Long recordId) {
        return dbCinemaRecordsRepository.findById(recordId).orElseThrow(
                () -> new ResourceNotFoundException("DB Cinema Record", "record id", recordId.toString())
        );
    }

    @Override
    public List<DBCinemaRecordsDto> searchRecordByKeyword(String keyword) {
        try {
            TypedQuery<DBCinemaRecordsEntity> query = entityManager.createQuery(SEARCH_RECORD_BY_KEYWORD, DBCinemaRecordsEntity.class);
            query.setParameter("keyword", "%" + keyword + "%");
            List<DBCinemaRecordsEntity> dbCinemaRecordsEntities = query.getResultList();
            return dbCinemaRecordsEntities.stream().map(
                    dbCinemaRecordsEntity -> this.dbWorldUtils.convertDbCinemaRecordEntityToDto(dbCinemaRecordsEntity)
            ).toList();
        } catch (Exception ex) {
            throw new DbWorldException(ex.getMessage());
        }
    }

    @Override
    public void likeRecord(Long recordId) {
        UserEntity userEntity;
        try {
            userEntity = this.userService.getUserFromToken();
        } catch (AuthenticationException ex) {
            throw new AuthenticationServiceException("Token is not valid. Please do login again.");
        }
        UserLikeRecordEntity userLikeRecordEntity = this.userLikedRecordRepository
                .findByUserUserIdAndDbCinemaRecordId(userEntity.getUserId(), recordId)
                .orElseGet(() -> {
                    UserLikeRecordEntity newUserLikeRecordEntity = new UserLikeRecordEntity();
                    newUserLikeRecordEntity.setDbCinemaRecord(getRecordEntityById(recordId));
                    newUserLikeRecordEntity.setUser(userEntity);
                    return newUserLikeRecordEntity;
                });
        userLikeRecordEntity.setLiked(true);
        this.userLikedRecordRepository.save(userLikeRecordEntity);
    }

    @Override
    @Transactional
    public void unLikeRecord(Long recordId) {
        try {
            this.userLikedRecordRepository.setIsLikeAsFalseByUserIdRecordId(this.userService.getUserIdFromToken(), recordId);
        } catch (AuthenticationException ex) {
            throw new AuthenticationServiceException("Token is not valid. Please do login again.");
        } catch (Exception ex) {
            ex.printStackTrace();
            throw new DbWorldException(ex.getMessage());
        }
    }

    @Transactional
    @Override
    public void watchListRecord(Long recordId) {
        try {
            UserEntity userEntity = this.userService.getUserFromToken();
            UserWatchlistRecordEntity userWatchlistRecordEntity = this.userWatchlistRecordRepository
                    .findByUserUserIdAndDbCinemaRecordId(userEntity.getUserId(), recordId)
                    .orElseGet(() -> {
                        UserWatchlistRecordEntity uwr = new UserWatchlistRecordEntity();
                        uwr.setDbCinemaRecord(getRecordEntityById(recordId));
                        uwr.setUser(userEntity);
                        return uwr;
                    });
            userWatchlistRecordEntity.setWatchListed(true);
            this.userWatchlistRecordRepository.save(userWatchlistRecordEntity);
        } catch (AuthenticationException ex) {
            throw new AuthenticationServiceException("Token is not valid. Please do login again.");
        } catch (Exception ex) {
            throw new DbWorldException(ex.getMessage());
        }
    }

    @Transactional
    @Override
    public void removeWatchListRecord(Long recordId) {
        try {
            this.userWatchlistRecordRepository.setIsWatchlistAsFalseByUserIdRecordId(this.userService.getUserIdFromToken(), recordId);
        } catch (AuthenticationException ex) {
            throw new AuthenticationServiceException("Token is not valid. Please do login again.");
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
                    dbCinemaRecordsEntity -> {
                        DBCinemaRecordsDto dbCinemaRecordsDto = this.dbWorldUtils.convertDbCinemaRecordEntityToDto(dbCinemaRecordsEntity);
                        dbCinemaRecordsDto.setWatchListed(true);
                        return dbCinemaRecordsDto;
                    }
            ).toList();
        } catch (AuthenticationException ex) {
            throw new AuthenticationServiceException("Token is not valid. Please do login again.");
        } catch (Exception ex) {
            throw new DbWorldException(ex.getMessage());
        }
    }

    @Override
    @Transactional
    public Map<String, Object> updateTmdbWithLatest() {

        Map<Long, String> failedIds = new HashMap<>();
        List<Long> successIds = new ArrayList<>();
        Map<String, Object> response = new HashMap<>();

        try {
            List<TmdbDataEntity> tmdbDataEntities = tmdbDataRepository.findAll().stream().limit(5).toList();
            tmdbDataEntities.forEach(tmdbDataEntity -> {
                try {
                    if (tmdbDataEntity instanceof MovieTmdbDataEntity) {
                        updateTmdbForMovie(tmdbDataEntity);
                    } else if (tmdbDataEntity instanceof SeriesTmdbDataEntity) {
                        updateTmdbForSeries(tmdbDataEntity);
                    }
                    successIds.add(tmdbDataEntity.getId());
                    log.info("Success TMDB ID: {}", tmdbDataEntity.getId());
                    Thread.sleep(200);
                } catch (Exception ex) {
                    failedIds.put(tmdbDataEntity.getId(), ex.getMessage());
                    log.error("Failed ID: {} Error Message: {}", tmdbDataEntity.getId(), ex.getMessage());
                }
                log.info("completed tmdb: {}", tmdbDataEntity.getId());
            });
            response.put("success", successIds);
            response.put("failed", failedIds);
        } catch (Exception ex) {
            response.put("success", successIds);
            response.put("failed", failedIds);
            throw new DbWorldException(ex.getMessage(), response);
        }
        return response;
    }

    private TmdbDataEntity updateTmdbForSeries(TmdbDataEntity tmdbDataEntity) {
        SeriesTmdbDataDto seriesTmdbDataDto = getTMDBDetailsForSeriesById(new RequestPayloads.AddRecord(
                tmdbDataEntity.getTitle(), tmdbDataEntity.getId(), DbWorldConstants.RECORD_TYPE_SERIES, false
        ));
        SeriesTmdbDataEntity seriesTmdbDataEntity = dbWorldUtils.convertSeriesTmdbDtoToEntity(seriesTmdbDataDto);
        seriesTmdbDataEntity.setDbCinemaRecordsEntity(tmdbDataEntity.getDbCinemaRecordsEntity());
        if (tmdbDataEntity.getProviders() != null && seriesTmdbDataEntity.getProviders() != null) {
            seriesTmdbDataEntity.getProviders().setId(tmdbDataEntity.getProviders().getId());
        }
        if (tmdbDataEntity.getCredits() != null && seriesTmdbDataEntity.getCredits() != null) {
            seriesTmdbDataEntity.getCredits().setId(tmdbDataEntity.getCredits().getId());
        }
        return mergeTmdbEntity(seriesTmdbDataEntity);
    }

    private TmdbDataEntity updateTmdbForMovie(TmdbDataEntity tmdbDataEntity) {
        MovieTmdbDataDto movieTmdbDataDto = getTMDBDetailsForMovieById(new RequestPayloads.AddRecord(
                tmdbDataEntity.getTitle(), tmdbDataEntity.getId(), DbWorldConstants.RECORD_TYPE_MOVIE, false
        ));
//        MovieTmdbDataEntity movieTmdbDataEntity = dbWorldUtils.convertMovieTmdbDtoToEntity(movieTmdbDataDto);
//        movieTmdbDataEntity.setDbCinemaRecordsEntity(tmdbDataEntity.getDbCinemaRecordsEntity());
//        if (tmdbDataEntity.getProviders() == null && movieTmdbDataEntity.getProviders() == null) {
//
//        }else if (tmdbDataEntity.getProviders() == null && movieTmdbDataEntity.getProviders() != null){
//
//        } else if (tmdbDataEntity.getProviders() != null && movieTmdbDataEntity.getProviders() != null){
//            movieTmdbDataEntity.getProviders().setId(tmdbDataEntity.getProviders().getId());
//        }
//        if (tmdbDataEntity.getCredits() != null) {
//            movieTmdbDataEntity.getCredits().setId(tmdbDataEntity.getCredits().getId());
//        }
        return mergeTmdbEntity(pojoConverter.movieTmdbDtoToEntity(movieTmdbDataDto, (MovieTmdbDataEntity) tmdbDataEntity));
    }

    @Override
    public Map<String, Long> getStatusOfRecordsUpdate() {
        return Map.of();
    }

    @Override
    public boolean isRecordsUpdateRunning() {
        return false;
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


//        if(!tmdbDataEntity.getProduction_companies().isEmpty()){
//            tmdbDataEntity.setProduction_companies(tmdbDataEntity.getProduction_companies().stream().map(
//                    productionCompany -> {
//                        ProductionCompaniesEntity productionCompaniesEntity = entityManager.find(ProductionCompaniesEntity.class, productionCompany.getId());
//                        if(productionCompaniesEntity == null){
//                            entityManager.persist(productionCompany);
//                        }
//                        return productionCompany;
//                    }
//            ).toList());
//        }
//
//        if(!tmdbDataEntity.getProduction_countries().isEmpty()){
//            tmdbDataEntity.setProduction_countries(tmdbDataEntity.getProduction_countries().stream().map(
//                    productionCountries -> {
//                        ProductionCountriesEntity productionCountriesEntity = entityManager.find(ProductionCountriesEntity.class, productionCountries.getIso_3166_1());
//                        if(productionCountriesEntity == null){
//                            entityManager.persist(productionCountries);
//                        }
//                        return productionCountries;
//                    }
//            ).toList());
//        }
//
//        if(!tmdbDataEntity.getSpoken_languages().isEmpty()){
//            tmdbDataEntity.setSpoken_languages(tmdbDataEntity.getSpoken_languages().stream().map(
//                    spokenLanguage -> {
//                        SpokenLanguageEntity spokenLanguageEntity = entityManager.find(SpokenLanguageEntity.class, spokenLanguage.getIso_639_1());
//                        if(spokenLanguageEntity == null){
//                            entityManager.persist(spokenLanguage);
//                        }
//                        return spokenLanguage;
//                    }
//            ).toList());
//        }
//
//        if(!tmdbDataEntity.getVideos().isEmpty()){
//            tmdbDataEntity.setVideos(tmdbDataEntity.getVideos().stream().map(videosEntity -> {
//                if(videosEntity.getIso_639_1() != null) {
//                    SpokenLanguageEntity spokenLanguageEntity = entityManager.find(SpokenLanguageEntity.class, videosEntity.getIso_639_1().getIso_639_1());
//                    if (spokenLanguageEntity == null) {
//                        entityManager.persist(videosEntity.getIso_639_1());
//                    }
//                }
//                if(videosEntity.getIso_3166_1() != null){
//                    ProductionCountriesEntity productionCountries = entityManager.find(ProductionCountriesEntity.class, videosEntity.getIso_3166_1().getIso_3166_1());
//                    if(productionCountries == null){
//                        entityManager.persist(videosEntity.getIso_3166_1());
//                    }
//                }
//                return videosEntity;
//            }).toList());
//        }
//
//        if(!tmdbDataEntity.getImages().isEmpty()){
//            tmdbDataEntity.setImages(tmdbDataEntity.getImages().stream().map(imagesEntity -> {
//                if(imagesEntity.getIso_639_1() != null) {
//                    SpokenLanguageEntity spokenLanguageEntity = entityManager.find(SpokenLanguageEntity.class, imagesEntity.getIso_639_1().getIso_639_1());
//                    if (spokenLanguageEntity == null) {
//                        entityManager.persist(imagesEntity.getIso_639_1());
//                    }
//                }
//                return imagesEntity;
//            }).toList());
//        }

        if (tmdbDataEntity.getCredits() != null) {
            if (tmdbDataEntity.getCredits().getCast() != null) {
                tmdbDataEntity.getCredits().setCast(tmdbDataEntity.getCredits().getCast().stream().map(cast -> entityManager.merge(cast)).toList());
            }
            if (tmdbDataEntity.getCredits().getCrew() != null) {
                tmdbDataEntity.getCredits().setCrew(tmdbDataEntity.getCredits().getCrew().stream().map(crew -> entityManager.merge(crew)).toList());
            }
            tmdbDataEntity.getCredits().setTmdb(tmdbDataEntity);
            tmdbDataEntity.setCredits(tmdbDataEntity.getCredits());
        }

        tmdbDataEntity.setGenres(tmdbDataEntity.getGenres().stream().map(genresEntity -> entityManager.merge(genresEntity)).toList());

        if (tmdbDataEntity.getProviders() != null) {
            tmdbDataEntity.getProviders().setTmdb(tmdbDataEntity);
            tmdbDataEntity.setProviders(tmdbDataEntity.getProviders());
        }
        return entityManager.merge(tmdbDataEntity);
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
