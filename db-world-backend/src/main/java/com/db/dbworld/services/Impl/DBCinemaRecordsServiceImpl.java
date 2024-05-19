package com.db.dbworld.services.Impl;

import com.db.dbworld.dao.dbcinema.DBCinemaRecordsRepository;
import com.db.dbworld.dao.dbcinema.MovieTmdbDataRepository;
import com.db.dbworld.dao.dbcinema.SeriesTmdbDataRepository;
import com.db.dbworld.entities.dbcinema.DBCinemaRecordsEntity;
import com.db.dbworld.entities.dbcinema.MovieTmdbDataEntity;
import com.db.dbworld.entities.dbcinema.SeriesTmdbDataEntity;
import com.db.dbworld.exceptions.DbWorldException;
import com.db.dbworld.exceptions.DuplicateResourceException;
import com.db.dbworld.exceptions.ResourceNotFoundException;
import com.db.dbworld.exceptions.TmdbApiException;
import com.db.dbworld.payloads.RequestPayloads;
import com.db.dbworld.payloads.ResponsePayloads;
import com.db.dbworld.payloads.dbcinema.DBCinemaRecordsDto;
import com.db.dbworld.payloads.dbcinema.MovieTmdbDataDto;
import com.db.dbworld.payloads.dbcinema.SeriesTmdbDataDto;
import com.db.dbworld.payloads.user.UserDto;
import com.db.dbworld.services.DBCinemaRecordsService;
import com.db.dbworld.services.UserService;
import com.db.dbworld.utils.DbWorldConstants;
import com.db.dbworld.utils.DbWorldUtils;
import com.google.gson.Gson;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import lombok.extern.log4j.Log4j2;
import org.modelmapper.ModelMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.domain.*;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoOperations;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.RestTemplate;

import java.util.*;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.Collectors;

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
    private MongoOperations mongoOperations;

    @Autowired
    private DBCinemaRecordsRepository dbCinemaRecordsRepository;

    @Autowired
    private MovieTmdbDataRepository movieTmdbDataRepository;

    @Autowired
    private SeriesTmdbDataRepository seriesTmdbDataRepository;

    @Autowired
    private UserService userService;

    private Map<String, Long> updateRecordsStatus = new HashMap<>();

    public boolean isRecordsUpdateRunning=false;

    @Override
    public DBCinemaRecordsDto addRecord(RequestPayloads.AddRecord record) {
        try {
            DBCinemaRecordsDto dbCinemaRecordsDto = modelMapper.map(record, DBCinemaRecordsDto.class);
            DBCinemaRecordsEntity newDbCinemaRecordsEntity = null;
            if (record.getType().equalsIgnoreCase(DbWorldConstants.RECORD_TYPE_MOVIE)) {
                MovieTmdbDataDto movieTmdbDataDto = getTMDBDetailsForMovieById(record);
                dbCinemaRecordsDto.setName(movieTmdbDataDto.getTitle());
                newDbCinemaRecordsEntity = dbCinemaRecordsRepository.save(modelMapper.map(dbCinemaRecordsDto, DBCinemaRecordsEntity.class));
                movieTmdbDataDto.setDbCinemaRecordId(newDbCinemaRecordsEntity.getRecordId().toString());
                MovieTmdbDataEntity newMovieTmdbDataEntity = movieTmdbDataRepository.save(modelMapper.map(movieTmdbDataDto, MovieTmdbDataEntity.class));
            } else if (record.getType().equalsIgnoreCase(DbWorldConstants.RECORD_TYPE_SERIES)) {
                SeriesTmdbDataDto seriesTmdbDataDto = getTMDBDetailsForSeriesById(record);
                dbCinemaRecordsDto.setName(seriesTmdbDataDto.getTitle());
                newDbCinemaRecordsEntity = dbCinemaRecordsRepository.save(modelMapper.map(dbCinemaRecordsDto, DBCinemaRecordsEntity.class));
                seriesTmdbDataDto.setDbCinemaRecordId(newDbCinemaRecordsEntity.getRecordId().toString());
                SeriesTmdbDataEntity newSeriesTmdbDataEntity = seriesTmdbDataRepository.save(modelMapper.map(seriesTmdbDataDto, SeriesTmdbDataEntity.class));
            }
            return modelMapper.map(newDbCinemaRecordsEntity, DBCinemaRecordsDto.class);
        } catch (DuplicateKeyException ex) {
            throw new DuplicateResourceException("DBCinemaRecordsEntity", "tmdbId", Long.toString(record.getTmdbId()));
        }
    }

    @Override
    public void updateRecord(String recordId, RequestPayloads.AddRecord record) {

        if (record.getType().equalsIgnoreCase(DbWorldConstants.RECORD_TYPE_MOVIE)) {
            //get tmdbdata from tmdbapi
            MovieTmdbDataDto movieTmdbDataDto = getTMDBDetailsForMovieById(record);
            movieTmdbDataDto.setDbCinemaRecordId(recordId);

            Update update = new Update();
            update.set("name", movieTmdbDataDto.getTitle());
            update.set("tmdbId", movieTmdbDataDto.getId());
            DBCinemaRecordsEntity dbCinemaRecordsEntity = mongoOperations.findAndModify(
                    new Query(Criteria.where("recordId").is(recordId)), update,
                    new FindAndModifyOptions().returnNew(true), DBCinemaRecordsEntity.class);

            //get data from Dbword db
            mongoOperations.findAndRemove(new Query(Criteria.where("dbCinemaRecordId").is(recordId)), MovieTmdbDataEntity.class);
            this.movieTmdbDataRepository.save(this.modelMapper.map(movieTmdbDataDto, MovieTmdbDataEntity.class));


        } else if (record.getType().equalsIgnoreCase(DbWorldConstants.RECORD_TYPE_SERIES)) {


            //get tmdbdata from tmdbapi
            SeriesTmdbDataDto seriesTmdbDataDto = getTMDBDetailsForSeriesById(record);
            seriesTmdbDataDto.setDbCinemaRecordId(recordId);

            Update update = new Update();
            update.set("name", seriesTmdbDataDto.getTitle());
            update.set("tmdbId", seriesTmdbDataDto.getId());
            DBCinemaRecordsEntity dbCinemaRecordsEntity = mongoOperations.findAndModify(
                    new Query(Criteria.where("recordId").is(recordId)), update,
                    new FindAndModifyOptions().returnNew(true), DBCinemaRecordsEntity.class);

            //get data from Dbword db
            mongoOperations.findAndRemove(new Query(Criteria.where("dbCinemaRecordId").is(recordId)), SeriesTmdbDataEntity.class);
            this.seriesTmdbDataRepository.save(this.modelMapper.map(seriesTmdbDataDto, SeriesTmdbDataEntity.class));

        } else {
            throw new ResourceNotFoundException("Db Cinema Record", "record type", record.getType());
        }
    }

    @Override
    public void deleteRecord(String recordId) {
        DBCinemaRecordsEntity dbCinemaRecordsEntity = this.dbCinemaRecordsRepository.findById(recordId)
                .orElseThrow(() -> new ResourceNotFoundException("DBCinema Record", "recordId", recordId));

        Query query = Query.query(Criteria.where("dbCinemaRecordId").is(dbCinemaRecordsEntity.getTmdbId()));
        if (dbCinemaRecordsEntity.getType().equalsIgnoreCase(DbWorldConstants.RECORD_TYPE_MOVIE)) {
            mongoOperations.findAndRemove(query, MovieTmdbDataEntity.class);
        } else {
            mongoOperations.findAndRemove(query, SeriesTmdbDataEntity.class);
        }
        dbCinemaRecordsRepository.deleteById(recordId);

        //delete from users userAppdata
        dbCinemaRecordsEntity.getLikedBy().stream().forEach(userId -> {
            UserDto.UserAppData userAppData = userService.getUserAppDataByUserId(userId);
            userAppData.getCinemaRecord().setLike((ArrayList<String>) userAppData.getCinemaRecord().getLike().stream().filter(tempRecordId -> !tempRecordId.equalsIgnoreCase(recordId)).toList());
            userService.updateUserAppDataByUserId(userId, userAppData);
        });
        dbCinemaRecordsEntity.getWatchListBy().stream().forEach(userId -> {
            UserDto.UserAppData userAppData = userService.getUserAppDataByUserId(userId);
            userAppData.getCinemaRecord().setWatchList((ArrayList<String>) userAppData.getCinemaRecord().getWatchList().stream().filter(tempRecordId -> !tempRecordId.equalsIgnoreCase(recordId)).toList());
            userService.updateUserAppDataByUserId(userId, userAppData);
        });
    }

    @Override
    public List<DBCinemaRecordsDto> getRecords() {
        List<DBCinemaRecordsEntity> dbCinemaRecordsEntityList = dbCinemaRecordsRepository.findAll();
        return dbCinemaRecordsEntityList.stream().map(dbCinemaRecordsEntity -> this.modelMapper.map(dbCinemaRecordsEntity, DBCinemaRecordsDto.class)).toList();
    }

    @Override
    public ResponsePayloads.PaginationRecords getRecordsByPagination(String recordType, int pageNumber, int pageSize) {
        Pageable pageable = PageRequest.of(pageNumber, pageSize, Sort.by("recordId").descending());
        Query query = Query.query(Criteria.where("type").is(recordType));


        long totalElement = mongoOperations.count(query, DBCinemaRecordsEntity.class);
        List<DBCinemaRecordsEntity> dbCinemaRecordsEntities = mongoOperations.find(query.with(pageable), DBCinemaRecordsEntity.class);
        List<Long> tmdbIds = dbCinemaRecordsEntities.stream().map(dbCinemaRecordsEntity -> dbCinemaRecordsEntity.getTmdbId()).toList();
        List<MovieTmdbDataEntity> movieTmdbDataEntities = movieTmdbDataRepository.findAllById(tmdbIds);

        Page<DBCinemaRecordsEntity> dbCinemaRecordPage = new PageImpl<>(dbCinemaRecordsEntities, pageable, totalElement);

        List<DBCinemaRecordsDto> dbCinemaRecordsDtos = dbCinemaRecordsEntities.stream().map(dbCinemaRecordsEntity -> {
            MovieTmdbDataEntity movieTmdbDataEntity = movieTmdbDataEntities.stream().filter(
                    movieTmdbData -> movieTmdbData.getId() == dbCinemaRecordsEntity.getTmdbId()
            ).toList().get(0);
            DBCinemaRecordsDto dbCinemaRecordsDto = this.modelMapper.map(dbCinemaRecordsEntity, DBCinemaRecordsDto.class);
            dbCinemaRecordsDto.setTmdbData(this.modelMapper.map(movieTmdbDataEntity, MovieTmdbDataDto.class));
            return dbCinemaRecordsDto;
        }).toList();


        ResponsePayloads.PaginationRecords paginationRecords = new ResponsePayloads.PaginationRecords();
        paginationRecords.setPageNumber(dbCinemaRecordPage.getNumber());
        paginationRecords.setPageSize(dbCinemaRecordPage.getSize());
        paginationRecords.setTotalElements(dbCinemaRecordPage.getTotalElements());
        paginationRecords.setLast(dbCinemaRecordPage.isLast());
        paginationRecords.setFirst(dbCinemaRecordPage.isFirst());
        paginationRecords.setEmpty(dbCinemaRecordPage.isEmpty());
        paginationRecords.setRecords(dbCinemaRecordsDtos);

        return paginationRecords;

    }

    @Override
    public ResponsePayloads.PaginationRecords getRecordsByPagination(String recordType, int pageNumber, int pageSize, String languages, String username) {
        List<DBCinemaRecordsDto> dbCinemaRecordsDtos = null;
        Page<DBCinemaRecordsEntity> dbCinemaRecordPage = null;

        String userId = userService.getUserIdByUsername(username);

        Pageable pageable = PageRequest.of(pageNumber, pageSize, Sort.by("dbCinemaRecordId").descending());
        Query query = new Query();
        if (!languages.equalsIgnoreCase("all")) {
            query.addCriteria(Criteria.where("original_language").in(Arrays.stream(languages.split(",")).toList()));
        }

        if (recordType.equalsIgnoreCase("movie")) {
            long totalElement = mongoOperations.count(query, MovieTmdbDataEntity.class);
            List<MovieTmdbDataEntity> movieTmdbDataEntities = mongoOperations.find(query.with(pageable), MovieTmdbDataEntity.class);
            List<Long> tmdbIds = movieTmdbDataEntities.stream().map(movieTmdbDataEntity -> movieTmdbDataEntity.getId()).toList();

            Query dbCinemaRecordsQuery = new Query(Criteria.where("tmdbId").in(tmdbIds)).with(Sort.by("recordId").descending());
            List<DBCinemaRecordsEntity> dbCinemaRecordsEntities = mongoOperations.find(dbCinemaRecordsQuery, DBCinemaRecordsEntity.class);

            dbCinemaRecordPage = new PageImpl<>(dbCinemaRecordsEntities, pageable, totalElement);

            dbCinemaRecordsDtos = dbCinemaRecordsEntities.stream().map(dbCinemaRecordsEntity -> {
                MovieTmdbDataEntity movieTmdbDataEntity = movieTmdbDataEntities.stream().filter(
                        movieTmdbData -> movieTmdbData.getId() == dbCinemaRecordsEntity.getTmdbId()
                ).toList().get(0);
                DBCinemaRecordsDto dbCinemaRecordsDto = this.modelMapper.map(dbCinemaRecordsEntity, DBCinemaRecordsDto.class);
                dbCinemaRecordsDto = filterDataByUser(dbCinemaRecordsDto, userId);
                dbCinemaRecordsDto.setTmdbData(this.modelMapper.map(movieTmdbDataEntity, MovieTmdbDataDto.class));
                return dbCinemaRecordsDto;
            }).toList();

        } else if (recordType.equalsIgnoreCase("series")) {
            long totalElement = mongoOperations.count(query, SeriesTmdbDataEntity.class);
            List<SeriesTmdbDataEntity> seriesTmdbDataEntities = mongoOperations.find(query.with(pageable), SeriesTmdbDataEntity.class);
            List<Long> tmdbIds = seriesTmdbDataEntities.stream().map(seriesTmdbDataEntity -> seriesTmdbDataEntity.getId()).toList();

            Query dbCinemaRecordsQuery = new Query(Criteria.where("tmdbId").in(tmdbIds)).with(Sort.by("recordId").descending());
            List<DBCinemaRecordsEntity> dbCinemaRecordsEntities = mongoOperations.find(dbCinemaRecordsQuery, DBCinemaRecordsEntity.class);

            dbCinemaRecordPage = new PageImpl<>(dbCinemaRecordsEntities, pageable, totalElement);

            dbCinemaRecordsDtos = dbCinemaRecordsEntities.stream().map(dbCinemaRecordsEntity -> {
                SeriesTmdbDataEntity seriesTmdbDataEntity = seriesTmdbDataEntities.stream().filter(
                        seriesTmdbData -> seriesTmdbData.getId() == dbCinemaRecordsEntity.getTmdbId()
                ).toList().get(0);
                DBCinemaRecordsDto dbCinemaRecordsDto = this.modelMapper.map(dbCinemaRecordsEntity, DBCinemaRecordsDto.class);
                dbCinemaRecordsDto = filterDataByUser(dbCinemaRecordsDto, userId);
                dbCinemaRecordsDto.setTmdbData(this.modelMapper.map(seriesTmdbDataEntity, SeriesTmdbDataDto.class));
                return dbCinemaRecordsDto;
            }).toList();
        }

        ResponsePayloads.PaginationRecords paginationRecords = new ResponsePayloads.PaginationRecords();
        paginationRecords.setPageNumber(dbCinemaRecordPage.getNumber());
        paginationRecords.setPageSize(dbCinemaRecordPage.getSize());
        paginationRecords.setTotalElements(dbCinemaRecordPage.getTotalElements());
        paginationRecords.setLast(dbCinemaRecordPage.isLast());
        paginationRecords.setFirst(dbCinemaRecordPage.isFirst());
        paginationRecords.setEmpty(dbCinemaRecordPage.isEmpty());
        paginationRecords.setRecords(dbCinemaRecordsDtos);

        return paginationRecords;
    }

    @Override
    public DBCinemaRecordsDto getRecordById(String recordId) {
        DBCinemaRecordsEntity dbCinemaRecordsEntity = dbCinemaRecordsRepository.findById(recordId)
                .orElseThrow(() -> new ResourceNotFoundException("dbCinemaRecord", "recordId", recordId));
        DBCinemaRecordsDto dbCinemaRecordsDto = this.modelMapper.map(dbCinemaRecordsEntity, DBCinemaRecordsDto.class);

        //Adding TMDB Data
        if (dbCinemaRecordsEntity.getType().equalsIgnoreCase(DbWorldConstants.RECORD_TYPE_MOVIE)) {
            MovieTmdbDataEntity movieTmdbDataEntity = movieTmdbDataRepository.findById(dbCinemaRecordsDto.getTmdbId())
                    .orElseThrow(() -> new ResourceNotFoundException("MovieTmdbData", "tmdbId", String.valueOf(dbCinemaRecordsDto.getTmdbId())));
            dbCinemaRecordsDto.setTmdbData(this.modelMapper.map(movieTmdbDataEntity, MovieTmdbDataDto.class));
        } else {
            SeriesTmdbDataEntity seriesTmdbDataEntity = seriesTmdbDataRepository.findById(dbCinemaRecordsEntity.getTmdbId())
                    .orElseThrow(() -> new ResourceNotFoundException("SeriesTmdbData", "tmdbId", String.valueOf(dbCinemaRecordsDto.getTmdbId())));
            dbCinemaRecordsDto.setTmdbData(this.modelMapper.map(seriesTmdbDataEntity, SeriesTmdbDataDto.class));
        }

        return dbCinemaRecordsDto;
    }

    @Override
    public List<DBCinemaRecordsDto> searchRecordByKeyword(String keyword) {
        Query query = new Query(Criteria.where("name").regex(".*" + keyword + ".*", "i")).limit(12);

        List<DBCinemaRecordsEntity> dbCinemaRecordsEntities = mongoOperations.find(query, DBCinemaRecordsEntity.class);
        List<Long> movieTmdbIds = dbCinemaRecordsEntities.stream()
                .filter(dbCinemaRecordsEntity -> dbCinemaRecordsEntity.getType().equalsIgnoreCase(DbWorldConstants.RECORD_TYPE_MOVIE))
                .map(dbCinemaRecordsEntity -> dbCinemaRecordsEntity.getTmdbId()).toList();

        List<Long> seriesTmdbIds = dbCinemaRecordsEntities.stream()
                .filter(dbCinemaRecordsEntity -> dbCinemaRecordsEntity.getType().equalsIgnoreCase(DbWorldConstants.RECORD_TYPE_SERIES))
                .map(dbCinemaRecordsEntity -> dbCinemaRecordsEntity.getTmdbId()).toList();

        List<MovieTmdbDataEntity> movieTmdbDataEntities = movieTmdbDataRepository.findAllById(movieTmdbIds);
        List<SeriesTmdbDataEntity> seriesTmdbDataEntities = seriesTmdbDataRepository.findAllById(seriesTmdbIds);

        List<DBCinemaRecordsDto> dbCinemaRecordsDtos = dbCinemaRecordsEntities.stream().map(dbCinemaRecordsEntity -> {
            DBCinemaRecordsDto dbCinemaRecordsDto = this.modelMapper.map(dbCinemaRecordsEntity, DBCinemaRecordsDto.class);
            if (dbCinemaRecordsEntity.getType().equalsIgnoreCase(DbWorldConstants.RECORD_TYPE_MOVIE)) {
                MovieTmdbDataEntity movieTmdbDataEntity = movieTmdbDataEntities.stream().filter(
                        movieTmdbData -> movieTmdbData.getId() == dbCinemaRecordsEntity.getTmdbId()
                ).toList().get(0);
                dbCinemaRecordsDto.setTmdbData(this.modelMapper.map(movieTmdbDataEntity, MovieTmdbDataDto.class));
            } else if (dbCinemaRecordsEntity.getType().equalsIgnoreCase(DbWorldConstants.RECORD_TYPE_SERIES)) {
                SeriesTmdbDataEntity seriesTmdbDataEntity = seriesTmdbDataEntities.stream().filter(
                        movieTmdbData -> movieTmdbData.getId() == dbCinemaRecordsEntity.getTmdbId()
                ).toList().get(0);

                dbCinemaRecordsDto.setTmdbData(this.modelMapper.map(seriesTmdbDataEntity, MovieTmdbDataDto.class));
            }
            return dbCinemaRecordsDto;
        }).toList();

        return dbCinemaRecordsDtos;
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

    @Override
    public void likeRecord(String userId, String recordId) {
        UserDto.UserAppData userAppDataDto = this.userService.getUserAppDataByUserId(userId);
        UserDto.UserAppData.CinemaRecord cinemaRecordDto = userAppDataDto.getCinemaRecord() == null ?
                new UserDto.UserAppData.CinemaRecord() : userAppDataDto.getCinemaRecord();

        //update recordId list in userAppData
        ArrayList<String> recordIdList = cinemaRecordDto.getLike() == null ? new ArrayList<>() : cinemaRecordDto.getLike();
        recordIdList.add(recordId);
        cinemaRecordDto.setLike(recordIdList);
        userAppDataDto.setCinemaRecord(cinemaRecordDto);
        this.userService.updateUserAppDataByUserId(userId, userAppDataDto);

        //update userId list in dbCinemaRecord
        DBCinemaRecordsEntity dbCinemaRecordsEntity = this.dbCinemaRecordsRepository.findById(recordId)
                .orElseThrow(() -> new ResourceNotFoundException("DbCinemaRecord", "recordId", recordId));

        ArrayList<String> userIdList = dbCinemaRecordsEntity.getLikedBy() == null ? new ArrayList<>() : dbCinemaRecordsEntity.getLikedBy();
        userIdList.add(userId);
        dbCinemaRecordsEntity.setLikedBy(userIdList);
        this.dbCinemaRecordsRepository.save(dbCinemaRecordsEntity);

    }

    @Override
    public void unLikeRecord(String userId, String recordId) {
        UserDto.UserAppData userAppDataDto = this.userService.getUserAppDataByUserId(userId);
        if (userAppDataDto.getCinemaRecord() == null) {
            throw new DbWorldException("There is no record for this user.");
        }
        UserDto.UserAppData.CinemaRecord cinemaRecordDto = userAppDataDto.getCinemaRecord();

        ArrayList<String> recordIdList = cinemaRecordDto.getLike();
        if (recordIdList == null) {
            throw new DbWorldException("There is no record for this user.");
        }

        //update recordId list in userAppData
        List<String> filteredList = recordIdList.stream().filter(id -> id.equalsIgnoreCase(recordId)).toList();
        if (filteredList.size() == 0) {
            throw new DbWorldException("User first have to like this record, then only can unlike it.");
        }
        recordIdList.remove(filteredList.get(0));
        cinemaRecordDto.setLike(recordIdList);
        userAppDataDto.setCinemaRecord(cinemaRecordDto);
        this.userService.updateUserAppDataByUserId(userId, userAppDataDto);

        //update userId list in dbCinemaRecord
        DBCinemaRecordsEntity dbCinemaRecordsEntity = this.dbCinemaRecordsRepository.findById(recordId)
                .orElseThrow(() -> new ResourceNotFoundException("DbCinemaRecord", "recordId", recordId));
        ArrayList<String> userIdList = dbCinemaRecordsEntity.getLikedBy();
        if (userIdList == null) {
            throw new DbWorldException("There is no record that user have liked this record.");
        }
        List<String> filteredUserList = userIdList.stream().filter(id -> id.equalsIgnoreCase(userId)).toList();
        if (filteredList.size() == 0) {
            throw new DbWorldException("User first have to like this record, then only can unlike it.");
        }

        userIdList.remove(filteredUserList.get(0));
        dbCinemaRecordsEntity.setLikedBy(userIdList);
        this.dbCinemaRecordsRepository.save(dbCinemaRecordsEntity);
    }

    @Override
    public void watchListRecord(String userId, String recordId) {
        UserDto.UserAppData userAppDataDto = this.userService.getUserAppDataByUserId(userId);
        UserDto.UserAppData.CinemaRecord cinemaRecordDto = userAppDataDto.getCinemaRecord() == null ?
                new UserDto.UserAppData.CinemaRecord() : userAppDataDto.getCinemaRecord();

        //update recordId list in userAppData
        ArrayList<String> recordIdList = cinemaRecordDto.getWatchList() == null ? new ArrayList<>() : cinemaRecordDto.getWatchList();
        recordIdList.add(recordId);
        cinemaRecordDto.setWatchList(recordIdList);
        userAppDataDto.setCinemaRecord(cinemaRecordDto);
        this.userService.updateUserAppDataByUserId(userId, userAppDataDto);

        //update userId list in dbCinemaRecord
        DBCinemaRecordsEntity dbCinemaRecordsEntity = this.dbCinemaRecordsRepository.findById(recordId)
                .orElseThrow(() -> new ResourceNotFoundException("DbCinemaRecord", "recordId", recordId));

        ArrayList<String> userIdList = dbCinemaRecordsEntity.getWatchListBy() == null ? new ArrayList<>() : dbCinemaRecordsEntity.getWatchListBy();
        userIdList.add(userId);
        dbCinemaRecordsEntity.setWatchListBy(userIdList);
        this.dbCinemaRecordsRepository.save(dbCinemaRecordsEntity);
    }

    @Override
    public void removeWatchListRecord(String userId, String recordId) {
        UserDto.UserAppData userAppDataDto = this.userService.getUserAppDataByUserId(userId);
        if (userAppDataDto.getCinemaRecord() == null) {
            throw new DbWorldException("There is no record for this user.");
        }
        UserDto.UserAppData.CinemaRecord cinemaRecordDto = userAppDataDto.getCinemaRecord();

        ArrayList<String> recordIdList = cinemaRecordDto.getWatchList();
        if (recordIdList == null) {
            throw new DbWorldException("There is no record for this user.");
        }

        //update recordId list in userAppData
        List<String> filteredList = recordIdList.stream().filter(id -> id.equalsIgnoreCase(recordId)).toList();
        if (filteredList.size() == 0) {
            throw new DbWorldException("User first have to like this record, then only can unlike it.");
        }
        recordIdList.remove(filteredList.get(0));
        cinemaRecordDto.setWatchList(recordIdList);
        userAppDataDto.setCinemaRecord(cinemaRecordDto);
        this.userService.updateUserAppDataByUserId(userId, userAppDataDto);

        //update userId list in dbCinemaRecord
        DBCinemaRecordsEntity dbCinemaRecordsEntity = this.dbCinemaRecordsRepository.findById(recordId)
                .orElseThrow(() -> new ResourceNotFoundException("DbCinemaRecord", "recordId", recordId));
        ArrayList<String> userIdList = dbCinemaRecordsEntity.getWatchListBy();
        if (userIdList == null) {
            throw new DbWorldException("There is no record that user have liked this record.");
        }
        List<String> filteredUserList = userIdList.stream().filter(id -> id.equalsIgnoreCase(userId)).toList();
        if (filteredList.size() == 0) {
            throw new DbWorldException("User first have to like this record, then only can unlike it.");
        }

        userIdList.remove(filteredUserList.get(0));
        dbCinemaRecordsEntity.setWatchListBy(userIdList);
        this.dbCinemaRecordsRepository.save(dbCinemaRecordsEntity);
    }

    @Override
    public List<DBCinemaRecordsDto> getWatchListCinemaRecords(String userId) {
        List<Object> watchListedRecords = new ArrayList<>();
        UserDto.UserAppData userAppData = this.userService.getUserAppDataByUserId(userId);
        ArrayList<String> userWatchListedRecordLists = userAppData.getCinemaRecord().getWatchList();
        List<DBCinemaRecordsEntity> dbCinemaRecordsEntityList = dbCinemaRecordsRepository.findAllById(userWatchListedRecordLists);
        return dbCinemaRecordsEntityList.stream().map(dbCinemaRecordsEntity -> {
                    DBCinemaRecordsDto dbCinemaRecordsDto = this.modelMapper.map(dbCinemaRecordsEntity, DBCinemaRecordsDto.class);
                    if (dbCinemaRecordsEntity.getType().equalsIgnoreCase(DbWorldConstants.RECORD_TYPE_MOVIE)) {
                        dbCinemaRecordsDto.setTmdbData(getTMDBDetailsForMovieById(
                                        new RequestPayloads.AddRecord(
                                                dbCinemaRecordsEntity.getName(),
                                                dbCinemaRecordsEntity.getTmdbId(),
                                                dbCinemaRecordsEntity.getType()
                                        )
                                )
                        );
                    } else if (dbCinemaRecordsEntity.getType().equalsIgnoreCase(DbWorldConstants.RECORD_TYPE_SERIES)) {
                        dbCinemaRecordsDto.setTmdbData(getTMDBDetailsForSeriesById(
                                        new RequestPayloads.AddRecord(
                                                dbCinemaRecordsEntity.getName(),
                                                dbCinemaRecordsEntity.getTmdbId(),
                                                dbCinemaRecordsEntity.getType()
                                        )
                                )
                        );
                    }
                    return dbCinemaRecordsDto;
                })
                .toList();
    }

    @Async
    @Override
    public void updateTmdbWithLatest() {
        if(this.isRecordsUpdateRunning){
            log.info("Process is already running on server.");
            throw new DbWorldException("Process is already running on server.");
        }else{
            this.isRecordsUpdateRunning=true;
            AtomicLong pass = new AtomicLong();
            AtomicLong fail = new AtomicLong();
            List<DBCinemaRecordsDto> dbCinemaRecordsDtos = this.getRecords();
            this.updateRecordsStatus.put("total", dbCinemaRecordsDtos.stream().count());
            this.updateRecordsStatus.put("pass",0L);
            this.updateRecordsStatus.put("fail",0L);
            dbCinemaRecordsDtos.stream().forEach(dbCinemaRecordsDto -> {
                try {
                    this.updateRecord(dbCinemaRecordsDto.getRecordId(),
                            new RequestPayloads.AddRecord(dbCinemaRecordsDto.getName(), dbCinemaRecordsDto.getTmdbId(), dbCinemaRecordsDto.getType()));
                    pass.getAndIncrement();
                    this.updateRecordsStatus.put("pass",pass.longValue());
                }
                catch (Exception ex){
                    fail.getAndIncrement();
                    this.updateRecordsStatus.put("fail",fail.longValue());
                    log.error("Record [TMDB Id = {}, name = {}] is failed. Error: {}", dbCinemaRecordsDto.getTmdbId(), dbCinemaRecordsDto.getName(), ex.getMessage());
                }
            });
            this.isRecordsUpdateRunning=false;
        }
    }

    @Override
    public Map<String, Long> getStatusOfRecordsUpdate(){
        return this.updateRecordsStatus;
    }

    @Override
    public boolean isRecordsUpdateRunning(){
        return this.isRecordsUpdateRunning;
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
            System.out.println("Error while getting tmdb provider details. Error: " + tmdbFilerResponse.getStatus_message());
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

    private DBCinemaRecordsDto filterDataByUser(DBCinemaRecordsDto dbCinemaRecordsDto, String userId) {
        if (dbCinemaRecordsDto.getLikedBy() != null) {
            dbCinemaRecordsDto.setLikedBy(
                    (ArrayList<String>) dbCinemaRecordsDto.getLikedBy().stream()
                            .filter(likeBy -> likeBy.equals(userId)).collect(Collectors.toList())
            );
        }
        if (dbCinemaRecordsDto.getWatchListBy() != null) {
            dbCinemaRecordsDto.setWatchListBy(
                    (ArrayList<String>) dbCinemaRecordsDto.getWatchListBy().stream()
                            .filter(watchListBy -> watchListBy.equals(userId)).collect(Collectors.toList())
            );
        }
        return dbCinemaRecordsDto;
    }

}
