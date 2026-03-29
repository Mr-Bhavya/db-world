//package com.db.dbworld.services.cinema;
//
//import com.db.dbworld.entities.dbcinema.DBCinemaRecordsEntity;
//import com.db.dbworld.helpers.DbWorldRecords;
//import com.db.dbworld.payloads.CustomPageImpl;
//import com.db.dbworld.payloads.RecordSearchCriteria;
//import com.db.dbworld.payloads.RequestPayloads;
//import com.db.dbworld.payloads.dbcinema.tmdb.GenresDto;
//import com.db.dbworld.payloads.dbcinema.tmdb.MovieTmdbDataDto;
//import com.db.dbworld.payloads.dbcinema.tmdb.SeriesTmdbDataDto;
//import com.db.dbworld.utils.DbWorldConstants;
//import org.springframework.data.domain.Pageable;
//
//import java.util.HashMap;
//import java.util.List;
//import java.util.Map;
//import java.util.Optional;
//
//public interface DBCinemaRecordsService {
//    DBCinemaRecordsDto addRecord(RequestPayloads.AddRecord record);
//
//    DBCinemaRecordsDto updateRecord(Long recordId, RequestPayloads.AddRecord record);
//
//    void switchShowOnTopRecord(Long recordId, boolean showOnTop);
//
//    void deleteRecord(Long recordId);
//
//    List<Map<String, Object>> getRecords();
//
//    List<Map<String, Object>> getRecordsWithStreamList();
//
//    Map<String, Object> getPaginatedRecords(
//            int page,
//            int size,
//            String search,
//            String type,
//            String sortBy,
//            String sortOrder,
//            boolean streamList);
//
//    List<DBCinemaRecordsDto> fetchCoverRecords(String[] recordTypes, int pageNumber, int pageSize);
//
//    CustomPageImpl<DBCinemaRecordsDto> findRecords(RecordSearchCriteria recordSearchCriteria);
//
//    DBCinemaRecordsDto getRecordById(Long recordId);
//
//    DBCinemaRecordsEntity getRecordEntityById(Long recordId);
//
//    Optional<DBCinemaRecordsEntity> getRecordEntityOptById(Long recordId);
//
//    List<DBCinemaRecordsDto> searchRecordByKeywordWithPagination(String keyword, Pageable pageable);
//
//    Integer countRecordsByKeyword(String keyword);
//
//    List<DbWorldRecords.CinemaRecordDto> searchRecordByKeyword(String keyword);
//
//    List<HashMap<String, Object>> getTmdbByQuery(DbWorldConstants.RECORD_TYE recordType, String query, int year);
//
//    MovieTmdbDataDto getTMDBDetailsForMovieById(RequestPayloads.AddRecord record);
//
//    SeriesTmdbDataDto getTMDBDetailsForSeriesById(RequestPayloads.AddRecord record);
//
//    DBCinemaRecordsDto userRecordDataProcess(Long recordId, String process);
//
//    CustomPageImpl<DBCinemaRecordsDto> getWatchListCinemaRecords(int pageNumber, int pageSize);
//
//    void updateTmdbWithLatest(Integer limit, boolean all);
//
//    void cancelUpdateTmdbWithLatest();
//
//    DbWorldRecords.TmdbUpdateProcessStatus getStatusOfRecordsUpdate();
//
//    boolean isRecordsUpdateRunning();
//
//    List<GenresDto> getAllGenres();
//
//    DBCinemaRecordsDto addUsersDbCinemaData(DBCinemaRecordsDto dbCinemaRecordsDto);
//}