package com.db.dbworld.services;

import com.db.dbworld.entities.dbcinema.DBCinemaRecordsEntity;
import com.db.dbworld.payloads.RequestPayloads;
import com.db.dbworld.payloads.dbcinema.DBCinemaRecordsDto;
import com.db.dbworld.payloads.dbcinema.tmdb.MovieTmdbDataDto;
import com.db.dbworld.payloads.dbcinema.tmdb.SeriesTmdbDataDto;
import org.springframework.data.domain.PageImpl;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

public interface DBCinemaRecordsService {
    DBCinemaRecordsDto addRecord(RequestPayloads.AddRecord record);

    DBCinemaRecordsDto updateRecord(Long recordId, RequestPayloads.AddRecord record);

    void deleteRecord(Long recordId);

    List<DBCinemaRecordsDto> getRecords();

    PageImpl<DBCinemaRecordsDto> getRecordsByPagination(String recordType, int pageNumber, int pageSize, String languages);

    DBCinemaRecordsDto getRecordById(Long recordId);

    DBCinemaRecordsEntity getRecordEntityById(Long recordId);

    List<DBCinemaRecordsDto> searchRecordByKeyword(String keyword);

    List<HashMap<String, Object>> getTmdbByQuery(String recordType, String query, int year);

    MovieTmdbDataDto getTMDBDetailsForMovieById(RequestPayloads.AddRecord record);

    SeriesTmdbDataDto getTMDBDetailsForSeriesById(RequestPayloads.AddRecord record);

    void likeRecord(Long recordId);

    void unLikeRecord(Long recordId);

    void watchListRecord(Long recordId);

    void removeWatchListRecord(Long recordId);

    List<DBCinemaRecordsDto> getWatchListCinemaRecords();

    void updateTmdbWithLatest();

    Map<String, Object> getStatusOfRecordsUpdate();

    boolean isRecordsUpdateRunning();
}