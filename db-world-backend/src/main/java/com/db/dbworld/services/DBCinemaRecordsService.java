package com.db.dbworld.services;

import com.db.dbworld.payloads.RequestPayloads;
import com.db.dbworld.payloads.ResponsePayloads;
import com.db.dbworld.payloads.dbcinema.DBCinemaRecordsDto;
import com.db.dbworld.payloads.dbcinema.MovieTmdbDataDto;
import com.db.dbworld.payloads.dbcinema.SeriesTmdbDataDto;

import java.util.List;
import java.util.Map;

public interface DBCinemaRecordsService {
    DBCinemaRecordsDto addRecord(RequestPayloads.AddRecord record);

    void updateRecord(String recordId, RequestPayloads.AddRecord record);

    void deleteRecord(String recordId);

    List<DBCinemaRecordsDto> getRecords();

    ResponsePayloads.PaginationRecords getRecordsByPagination(String recordType, int pageNumber, int pageSize);

    ResponsePayloads.PaginationRecords getRecordsByPagination(String recordType, int pageNumber, int pageSize, String languages, String username);

    DBCinemaRecordsDto getRecordById(String recordId);

    List<DBCinemaRecordsDto> searchRecordByKeyword(String keyword);

    MovieTmdbDataDto getTMDBDetailsForMovieById(RequestPayloads.AddRecord record);

    SeriesTmdbDataDto getTMDBDetailsForSeriesById(RequestPayloads.AddRecord record);

    void likeRecord(String userId, String recordId);

    void unLikeRecord(String userId, String recordId);

    void watchListRecord(String userId, String recordId);

    void removeWatchListRecord(String userId, String recordId);

    List<DBCinemaRecordsDto> getWatchListCinemaRecords(String userId);

    void updateTmdbWithLatest();

    Map<String, Long> getStatusOfRecordsUpdate();

    boolean isRecordsUpdateRunning();
}