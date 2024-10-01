package com.db.dbworld.controllers;

import com.db.dbworld.payloads.ApiResponse;
import com.db.dbworld.payloads.RequestPayloads;
import com.db.dbworld.payloads.ResponsePayloads;
import com.db.dbworld.payloads.dbcinema.DBCinemaRecordsDto;
import com.db.dbworld.security.JwtHelper;
import com.db.dbworld.services.DBCinemaRecordsService;
import com.db.dbworld.utils.DbWorldConstants;
import com.db.dbworld.utils.DbWorldUtils;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Log4j2
@RestController
@RequestMapping("/api/cinema")
@EnableMethodSecurity(prePostEnabled = true)
@CrossOrigin
public class DBCinemaController {

    @Autowired
    private DBCinemaRecordsService dbCinemaRecordsService;

    @Autowired
    private DbWorldUtils dbWorldUtils;

    @Autowired
    private JwtHelper jwtHelper;

    @PostMapping("/record")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse addDBCinemaRecord(@Valid @RequestBody RequestPayloads.AddRecord record) {
        DBCinemaRecordsDto newDBDbCinemaRecordsDto = dbCinemaRecordsService.addRecord(record);
        return new ApiResponse(HttpStatus.CREATED, true, newDBDbCinemaRecordsDto);
    }

    @GetMapping("/record")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse getDBCinemaRecords() {
        List<DBCinemaRecordsDto> dbCinemaRecordsDtoList = dbCinemaRecordsService.getRecords();
        return new ApiResponse(HttpStatus.OK, true, dbCinemaRecordsDtoList);
    }

    @PutMapping("/record/{recordId}")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse updateDBCinemaRecord(
            @PathVariable String recordId,
            @Valid @RequestBody RequestPayloads.AddRecord record) {
        dbCinemaRecordsService.updateRecord(recordId, record);
        return new ApiResponse(HttpStatus.OK, true, "Record Updated.");
    }

    @DeleteMapping("/record/{recordId}")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse deleteDBCinemaRecord(@PathVariable String recordId) {
        dbCinemaRecordsService.deleteRecord(recordId);
        return new ApiResponse(HttpStatus.OK, true, "Record deleted.");
    }

    @GetMapping("/record/type/{recordType}")
    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
    public ApiResponse getDBCinemaRecordByPagination(
            @Valid @NotEmpty @PathVariable("recordType") String recordType,
            @RequestParam(value = "page", required = false, defaultValue = "0") int pageNumber,
            @RequestParam(value = "size", required = false, defaultValue = "12") int pageSize,
            @RequestParam String languages,
            HttpServletRequest request
    ) {
        if (!recordType.equalsIgnoreCase("movie") && !recordType.equalsIgnoreCase("series")) {
            return new ApiResponse(HttpStatus.BAD_REQUEST, false, "record type must be movie or series.");
        }
        String bearerToken = request.getHeader("Authorization");
        String token = bearerToken.substring(7);
        ResponsePayloads.PaginationRecords recordsByPagination = dbCinemaRecordsService
                .getRecordsByPagination(recordType, pageNumber, pageSize, languages, dbWorldUtils.getUserFromToken(token));
        return new ApiResponse(HttpStatus.OK, true, recordsByPagination);
    }

    @GetMapping("/record/{recordId}")
    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
    public ApiResponse getDBCinemaRecordById(@PathVariable @NotEmpty String recordId) {
        DBCinemaRecordsDto dbCinemaRecordsDto = dbCinemaRecordsService.getRecordById(recordId);
        return new ApiResponse(HttpStatus.OK, true, dbCinemaRecordsDto);
    }

    @GetMapping("/record/search")
    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
    public ApiResponse searchRecordByKeyword(@RequestParam(value = "q") String query) {
        List<DBCinemaRecordsDto> dbCinemaRecordsDtos = dbCinemaRecordsService.searchRecordByKeyword(query);
        return new ApiResponse(HttpStatus.OK, true, dbCinemaRecordsDtos);
    }


    @GetMapping(value = "/tmdb/{recordType}/{tmdbId}")
    public ApiResponse getMovieTMDBDetailsById(
            @PathVariable("recordType") @NotEmpty String recordType,
            @PathVariable @NotNull Long tmdbId) {

        dbWorldUtils.checkRecordType(recordType);
        RequestPayloads.AddRecord record = new RequestPayloads.AddRecord();
        record.setType(recordType);
        record.setTmdbId(tmdbId);

        Object object = recordType.equalsIgnoreCase(DbWorldConstants.RECORD_TYPE_MOVIE) ?
                dbCinemaRecordsService.getTMDBDetailsForMovieById(record) : dbCinemaRecordsService.getTMDBDetailsForSeriesById(record);
        return new ApiResponse(HttpStatus.OK, true, object);
    }

    @GetMapping("/record/{recordId}/like")
    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
    public ApiResponse likeRecord(@PathVariable String recordId, @RequestParam String userId) {
        this.dbCinemaRecordsService.likeRecord(userId, recordId);
        return new ApiResponse(HttpStatus.OK, true, "like");
    }

    @GetMapping("/record/{recordId}/unlike")
    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
    public ApiResponse unLikeRecord(@PathVariable String recordId, @RequestParam String userId) {
        this.dbCinemaRecordsService.unLikeRecord(userId, recordId);
        return new ApiResponse(HttpStatus.OK, true, "Like is Removed.");
    }

    @GetMapping("/record/{recordId}/watchlist")
    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
    public ApiResponse watchListRecord(@PathVariable String recordId, @RequestParam String userId) {
        this.dbCinemaRecordsService.watchListRecord(userId, recordId);
        return new ApiResponse(HttpStatus.OK, true, "Record added in watchlist");
    }

    @GetMapping("/record/{recordId}/unwatchlist")
    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
    public ApiResponse removeWatchListRecord(@PathVariable String recordId, @RequestParam String userId) {
        this.dbCinemaRecordsService.removeWatchListRecord(userId, recordId);
        return new ApiResponse(HttpStatus.OK, true, "Record removed from watchlist");
    }

    @GetMapping("/watchlist")
    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
    public ApiResponse getWatchListCinemaRecords(@Valid @NotNull @RequestParam(value = "userId") String userId){
        List<DBCinemaRecordsDto> dbCinemaRecordsDtos = dbCinemaRecordsService.getWatchListCinemaRecords(userId);
        return new ApiResponse(HttpStatus.OK, true, dbCinemaRecordsDtos);
    }

    @GetMapping("/records/update")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse updateTmdbWithLatest(){
        if(dbCinemaRecordsService.isRecordsUpdateRunning()){
            return new ApiResponse(HttpStatus.PROCESSING, true, "Record update process already running." );
        }
        dbCinemaRecordsService.updateTmdbWithLatest();
        return new ApiResponse(HttpStatus.OK, true, "Task (Record update with tmdb) is accepted.");
    }

    @GetMapping("/records/update/status")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse recordUpdateStatus(){
        if(!dbCinemaRecordsService.isRecordsUpdateRunning()){
            return new ApiResponse(HttpStatus.OK, true, "Record update process is not running." );
        }
        return new ApiResponse(HttpStatus.OK, true, "Task (Record update with tmdb) is running.", dbCinemaRecordsService.getStatusOfRecordsUpdate());
    }

    @GetMapping("/tmdb/{recordType}/search")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse searchTmdbByQuery(@PathVariable @NotEmpty String recordType,
                                         @RequestParam @NotEmpty String q,
                                         @RequestParam(defaultValue = "0", required = false ) int year){
        List tmdbSearchList = dbCinemaRecordsService.getTmdbByQuery(recordType, q, year);
        return new ApiResponse<>(HttpStatus.OK, true, tmdbSearchList);
    }

//    @GetMapping(value = "/tmdb")
//    public ApiResponse getTMDBDetailsById(@RequestBody RequestPayloads.AddRecords record) {
//        MovieTmdbDataDto movieTmdbDataDto = dbCinemaRecordsService.getTMDBDetailsForRecordById(record);
//        return new ApiResponse(HttpStatus.OK, true, movieTmdbDataDto);
//    }

}
