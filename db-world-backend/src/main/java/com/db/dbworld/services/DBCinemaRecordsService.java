package com.db.dbworld.services;

import com.db.dbworld.entities.dbcinema.DBCinemaRecordsEntity;
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

    void deleteRecord(Long recordId);

    List<DBCinemaRecordsDto> getRecords();

    List<DBCinemaRecordsDto> fetchDbCinemaRecords(String recordType, Pageable pageable, String languages, String genres);

    Integer fetchCountOfDbCinemaRecords(String recordType, String languages, String genres);

    DBCinemaRecordsDto getRecordById(Long recordId);

    DBCinemaRecordsEntity getRecordEntityById(Long recordId);

    List<DBCinemaRecordsDto> searchRecordByKeyword(String keyword);

    List<HashMap<String, Object>> getTmdbByQuery(String recordType, String query, int year);

    MovieTmdbDataDto getTMDBDetailsForMovieById(RequestPayloads.AddRecord record);

    SeriesTmdbDataDto getTMDBDetailsForSeriesById(RequestPayloads.AddRecord record);

    DBCinemaRecordsDto userRecordDataProcess(Long recordId, String process);

    List<DBCinemaRecordsDto> getWatchListCinemaRecords();

    void updateTmdbWithLatest();

    Map<String, Object> getStatusOfRecordsUpdate();

    boolean isRecordsUpdateRunning();

    List<GenresDto> getAllGenres();

    DBCinemaRecordsDto addUsersDbCinemaData(DBCinemaRecordsDto dbCinemaRecordsDto);
}