package com.db.dbworld.controllers;

import com.db.dbworld.payloads.ApiResponse;
import com.db.dbworld.payloads.CustomPageImpl;
import com.db.dbworld.payloads.RecordSearchCriteria;
import com.db.dbworld.payloads.dbcinema.DBCinemaRecordsDto;
import com.db.dbworld.payloads.dbcinema.tmdb.GenresDto;
import com.db.dbworld.services.DBCinemaRecordsService;
import com.db.dbworld.utils.DbWorldConstants;
import com.db.dbworld.utils.DbWorldUtils;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import lombok.extern.log4j.Log4j2;
import org.modelmapper.ModelMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;

@Log4j2
@CrossOrigin
@RestController
@RequestMapping("/api/cinema")
public class DbCinemaController {

    @Autowired
    private DBCinemaRecordsService dbCinemaRecordsService;
    @Autowired
    private ModelMapper modelMapper;
    @Autowired
    private DbWorldUtils dbWorldUtils;

    @GetMapping("/record")
    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
    public ApiResponse<CustomPageImpl<DBCinemaRecordsDto>> getRecordsByPagination(
            @RequestParam(value = "page", required = false, defaultValue = "0") int pageNumber,
            @RequestParam(value = "size", required = false, defaultValue = "10") int pageSize,
            @RequestParam(required = false, defaultValue = "") String languages,
            @RequestParam(required = false, defaultValue = "") String genres,
            @RequestParam(value = "q", required = false) String query
    ) {
        CustomPageImpl<DBCinemaRecordsDto> pageResult = dbCinemaRecordsService.findRecords(
                new RecordSearchCriteria(null, genres, languages, query, true, pageNumber, pageSize)
        );
        pageResult.setRecords(pageResult.getRecords().stream()
                .map(dbCinemaRecordsDto -> dbCinemaRecordsService.addUsersDbCinemaData(dbCinemaRecordsDto)).toList());
        return new ApiResponse<>(HttpStatus.OK, true, pageResult);
    }

    @GetMapping("/record/type/{recordType}")
    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
    public ApiResponse<CustomPageImpl<DBCinemaRecordsDto>> getRecordsByTypeAndPagination(
            @Valid @NotEmpty @PathVariable("recordType") String recordType,
            @RequestParam(value = "page", required = false, defaultValue = "0") int pageNumber,
            @RequestParam(value = "size", required = false, defaultValue = "10") int pageSize,
            @RequestParam(required = false, defaultValue = "") String languages,
            @RequestParam(required = false, defaultValue = "") String genres
    ) {
        if (!recordType.equalsIgnoreCase(DbWorldConstants.RECORD_TYPE_MOVIE) && !recordType.equalsIgnoreCase(DbWorldConstants.RECORD_TYPE_SERIES)) {
            return new ApiResponse<>(HttpStatus.BAD_REQUEST, false, "record type must be movie or series.");
        }
        CustomPageImpl<DBCinemaRecordsDto> pageResult = dbCinemaRecordsService.findRecords(
                new RecordSearchCriteria(recordType, genres, languages, null, true, pageNumber, pageSize)
        );
        pageResult.setRecords(pageResult.getRecords().stream()
                .map(dbCinemaRecordsDto -> dbCinemaRecordsService.addUsersDbCinemaData(dbCinemaRecordsDto)).toList());
        return new ApiResponse<>(HttpStatus.OK, true, pageResult);
    }

    @GetMapping("/record/cover")
    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
    public ApiResponse<HashMap<Object, Object>> fetchCoverRecords(
            @RequestParam(value = "page", required = false, defaultValue = "0") int pageNumber,
            @RequestParam(value = "size", required = false, defaultValue = "5") int pageSize
    ) {
        HashMap<Object, Object> map = new HashMap<>();
        map.put("records", dbCinemaRecordsService.fetchCoverRecords(pageNumber, pageSize).stream()
                .map(dbCinemaRecordsDto -> dbCinemaRecordsService.addUsersDbCinemaData(dbCinemaRecordsDto)).toList());
        return new ApiResponse<>(HttpStatus.OK, true, map);
    }

    @GetMapping("/record/{recordId}")
    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
    public ApiResponse<DBCinemaRecordsDto> getDbCinemaRecordById(@Valid @PathVariable Long recordId) {
        DBCinemaRecordsDto dbCinemaRecordsDto = dbCinemaRecordsService.getRecordById(recordId);
        return new ApiResponse<>(HttpStatus.OK, true, dbCinemaRecordsDto);
    }

    @GetMapping("/record/{recordId}/like")
    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
    public ApiResponse<String> addLikeByRecord(@PathVariable Long recordId) {
        this.dbCinemaRecordsService.userRecordDataProcess(recordId, DbWorldConstants.PROCESS_LIKE);
        return new ApiResponse<>(HttpStatus.OK, true, "Record added in watchlist");
    }

    @GetMapping("/record/{recordId}/unlike")
    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
    public ApiResponse<String> removeLikeByRecord(@PathVariable Long recordId) {
        this.dbCinemaRecordsService.userRecordDataProcess(recordId, DbWorldConstants.PROCESS_UN_LIKE);
        return new ApiResponse<>(HttpStatus.OK, true, "Record removed from watchlist");
    }

    @GetMapping("/record/{recordId}/watch")
    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
    public ApiResponse<String> addWatchByRecord(@PathVariable Long recordId) {
        this.dbCinemaRecordsService.userRecordDataProcess(recordId, DbWorldConstants.PROCESS_WATCH);
        return new ApiResponse<>(HttpStatus.OK, true, "Record mark as watched.");
    }

    @GetMapping("/record/{recordId}/unwatch")
    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
    public ApiResponse<String> removeWatchByRecord(@PathVariable Long recordId) {
        this.dbCinemaRecordsService.userRecordDataProcess(recordId, DbWorldConstants.PROCESS_UN_WATCH);
        return new ApiResponse<>(HttpStatus.OK, true, "Record remove from watch mark.");
    }

    @GetMapping("/record/{recordId}/watchlist")
    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
    public ApiResponse<String> watchListRecord(@PathVariable Long recordId) {
        this.dbCinemaRecordsService.userRecordDataProcess(recordId, DbWorldConstants.PROCESS_WATCHLIST);
        return new ApiResponse<>(HttpStatus.OK, true, "Record added in watchlist");
    }

    @GetMapping("/record/{recordId}/unwatchlist")
    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
    public ApiResponse<String> removeWatchListRecord(@PathVariable Long recordId) {
        this.dbCinemaRecordsService.userRecordDataProcess(recordId, DbWorldConstants.PROCESS_UN_WATCHLIST);
        return new ApiResponse<>(HttpStatus.OK, true, "Record removed from watchlist");
    }

    @GetMapping("/watchlist")
    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
    public ApiResponse<CustomPageImpl<DBCinemaRecordsDto>> getWatchListCinemaRecords(
            @RequestParam(value = "page", required = false, defaultValue = "0") int pageNumber,
            @RequestParam(value = "size", required = false, defaultValue = "50") int pageSize
    ) {
        CustomPageImpl<DBCinemaRecordsDto> pageResult = dbCinemaRecordsService.getWatchListCinemaRecords(pageNumber, pageSize);
        pageResult.setRecords(pageResult.getRecords().stream()
                .map(dbCinemaRecordsDto -> dbCinemaRecordsService.addUsersDbCinemaData(dbCinemaRecordsDto)).toList());
        return new ApiResponse<>(HttpStatus.OK, true, pageResult);
    }

    @GetMapping("/genres")
    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
    public ApiResponse<List<GenresDto>> getAllGenres() {
        List<GenresDto> genresDtoList = dbCinemaRecordsService.getAllGenres();
        return new ApiResponse<>(HttpStatus.OK, true, genresDtoList);
    }

}
