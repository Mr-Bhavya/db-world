package com.db.dbworld.services;

import com.db.dbworld.entities.dbcinema.DBCinemaRecordsEntity;
import com.db.dbworld.payloads.CustomPageImpl;
import com.db.dbworld.payloads.RecordSearchCriteria;
import com.db.dbworld.payloads.RequestPayloads;
import com.db.dbworld.payloads.dbcinema.DBCinemaRecordsDto;
import com.db.dbworld.payloads.dbcinema.tmdb.GenresDto;
import com.db.dbworld.payloads.dbcinema.tmdb.MovieTmdbDataDto;
import com.db.dbworld.payloads.dbcinema.tmdb.SeriesTmdbDataDto;
import org.springframework.data.domain.Pageable;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

public interface DBCinemaRecordsService {
    DBCinemaRecordsDto addRecord(RequestPayloads.AddRecord record);

    DBCinemaRecordsDto updateRecord(Long recordId, RequestPayloads.AddRecord record);

    void switchShowOnTopRecord(Long recordId, boolean showOnTop);

    void deleteRecord(Long recordId);

    List<Map<String, Object>> getRecords();

    List<DBCinemaRecordsDto> fetchCoverRecords(int pageNumber, int pageSize);

    CustomPageImpl<DBCinemaRecordsDto> findRecords(RecordSearchCriteria recordSearchCriteria);

//    List<DBCinemaRecordsDto> fetchDbCinemaRecords(String recordType, Pageable pageable, String languages, String genres);
//
//    Integer fetchCountOfDbCinemaRecords();
//
//    Integer fetchCountOfDbCinemaRecords(String recordType, String languages, String genres);

    DBCinemaRecordsDto getRecordById(Long recordId);

    DBCinemaRecordsEntity getRecordEntityById(Long recordId);

//    List<DBCinemaRecordsDto> searchRecordByKeywordWithUserData(String keyword);

    List<DBCinemaRecordsDto> searchRecordByKeywordWithPagination(String keyword, Pageable pageable);

    Integer countRecordsByKeyword(String keyword);

    List<Map<String, String>> searchRecordByKeyword(String keyword);

    List<HashMap<String, Object>> getTmdbByQuery(String recordType, String query, int year);

    MovieTmdbDataDto getTMDBDetailsForMovieById(RequestPayloads.AddRecord record);

    SeriesTmdbDataDto getTMDBDetailsForSeriesById(RequestPayloads.AddRecord record);

    DBCinemaRecordsDto userRecordDataProcess(Long recordId, String process);

    CustomPageImpl<DBCinemaRecordsDto> getWatchListCinemaRecords(int pageNumber, int pageSize);

    void updateTmdbWithLatest();

    Map<String, Object> getStatusOfRecordsUpdate();

    boolean isRecordsUpdateRunning();

    List<GenresDto> getAllGenres();

    DBCinemaRecordsDto addUsersDbCinemaData(DBCinemaRecordsDto dbCinemaRecordsDto);
}