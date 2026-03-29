//package com.db.dbworld.controllers;
//
//import com.db.dbworld.payloads.ApiResponse;
//import com.db.dbworld.payloads.CustomPageImpl;
//import com.db.dbworld.payloads.RecordSearchCriteria;
//import com.db.dbworld.payloads.dbcinema.tmdb.GenresDto;
//import com.db.dbworld.services.cinema.DBCinemaRecordsService;
//import com.db.dbworld.utils.DbWorldConstants;
//import jakarta.validation.Valid;
//import jakarta.validation.constraints.NotEmpty;
//import lombok.extern.log4j.Log4j2;
//import org.apache.commons.lang3.StringUtils;
//import org.springframework.security.access.prepost.PreAuthorize;
//import org.springframework.web.bind.annotation.*;
//
//import java.util.HashMap;
//import java.util.List;
//
//@Log4j2
//@CrossOrigin
//@RestController
//@RequestMapping("/api/cinema")
//public class DbCinemaController {
//
//    private final DBCinemaRecordsService dbCinemaRecordsService;
//
//    public DbCinemaController(DBCinemaRecordsService dbCinemaRecordsService) {
//        this.dbCinemaRecordsService = dbCinemaRecordsService;
//    }
//
//    @GetMapping("/record")
//    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
//    public ApiResponse<CustomPageImpl<DBCinemaRecordsDto>> getRecordsByPagination(
//            @RequestParam(defaultValue = "0") int page,
//            @RequestParam(defaultValue = "10") int size,
//            @RequestParam(required = false, defaultValue = "") String languages,
//            @RequestParam(required = false, defaultValue = "") String genres,
//            @RequestParam(value = "q", required = false) String query) {
//
//        CustomPageImpl<DBCinemaRecordsDto> result = dbCinemaRecordsService.findRecords(
//                new RecordSearchCriteria(null, genres, languages, query, true, page, size)
//        );
//
//        if(StringUtils.isNotEmpty(query)) {
//
//        }
//
//        result.setRecords(result.getRecords().stream()
//                .map(dbCinemaRecordsService::addUsersDbCinemaData)
//                .toList());
//
//        return ApiResponse.success(result);
//    }
//
//    @GetMapping("/record/type/{recordType}")
//    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
//    public ApiResponse<CustomPageImpl<DBCinemaRecordsDto>> getRecordsByTypeAndPagination(
//            @Valid @NotEmpty @PathVariable String recordType,
//            @RequestParam(defaultValue = "0") int page,
//            @RequestParam(defaultValue = "10") int size,
//            @RequestParam(required = false, defaultValue = "") String languages,
//            @RequestParam(required = false, defaultValue = "") String genres) {
//
//        if (!recordType.equalsIgnoreCase("movie") && !recordType.equalsIgnoreCase("series")) {
//            throw new IllegalArgumentException("Record type must be movie or series");
//        }
//
//        CustomPageImpl<DBCinemaRecordsDto> result = dbCinemaRecordsService.findRecords(
//                new RecordSearchCriteria(recordType, genres, languages, null, true, page, size)
//        );
//
//        result.setRecords(result.getRecords().stream()
//                .map(dbCinemaRecordsService::addUsersDbCinemaData)
//                .toList());
//
//        return ApiResponse.success(result);
//    }
//
//    @GetMapping("/record/cover")
//    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
//    public ApiResponse<HashMap<Object, Object>> fetchCoverRecords(
//            @RequestParam String[] recordTypes,
//            @RequestParam(defaultValue = "0") int page,
//            @RequestParam(defaultValue = "5") int size) {
//
//        HashMap<Object, Object> response = new HashMap<>();
//        response.put("records", dbCinemaRecordsService.fetchCoverRecords(recordTypes, page, size)
//                .stream()
//                .map(dbCinemaRecordsService::addUsersDbCinemaData)
//                .toList());
//
//        return ApiResponse.success(response);
//    }
//
//    @GetMapping("/record/{recordId}")
//    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
//    public ApiResponse<DBCinemaRecordsDto> getDbCinemaRecordById(@PathVariable Long recordId) {
//        return ApiResponse.success(dbCinemaRecordsService.getRecordById(recordId));
//    }
//
//    @GetMapping("/record/{recordId}/like")
//    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
//    public ApiResponse<Void> addLikeByRecord(@PathVariable Long recordId) {
//        dbCinemaRecordsService.userRecordDataProcess(recordId, DbWorldConstants.PROCESS_LIKE);
//        return ApiResponse.success("Record added to watchlist");
//    }
//
//    @GetMapping("/record/{recordId}/unlike")
//    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
//    public ApiResponse<Void> removeLikeByRecord(@PathVariable Long recordId) {
//        dbCinemaRecordsService.userRecordDataProcess(recordId, DbWorldConstants.PROCESS_UN_LIKE);
//        return ApiResponse.success("Record removed from watchlist");
//    }
//
//    @GetMapping("/record/{recordId}/watch")
//    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
//    public ApiResponse<Void> addWatchByRecord(@PathVariable Long recordId) {
//        dbCinemaRecordsService.userRecordDataProcess(recordId, DbWorldConstants.PROCESS_WATCH);
//        return ApiResponse.success("Record marked as watched");
//    }
//
//    @GetMapping("/record/{recordId}/unwatch")
//    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
//    public ApiResponse<Void> removeWatchByRecord(@PathVariable Long recordId) {
//        dbCinemaRecordsService.userRecordDataProcess(recordId, DbWorldConstants.PROCESS_UN_WATCH);
//        return ApiResponse.success("Record unmarked as watched");
//    }
//
//    @GetMapping("/watchlist")
//    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
//    public ApiResponse<CustomPageImpl<DBCinemaRecordsDto>> getWatchListCinemaRecords(
//            @RequestParam(defaultValue = "0") int page,
//            @RequestParam(defaultValue = "50") int size) {
//
//        CustomPageImpl<DBCinemaRecordsDto> result = dbCinemaRecordsService.getWatchListCinemaRecords(page, size);
//        result.setRecords(result.getRecords().stream()
//                .map(dbCinemaRecordsService::addUsersDbCinemaData)
//                .toList());
//
//        return ApiResponse.success(result);
//    }
//
//    @GetMapping("/genres")
//    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
//    public ApiResponse<List<GenresDto>> getAllGenres() {
//        return ApiResponse.success(dbCinemaRecordsService.getAllGenres());
//    }
//}
