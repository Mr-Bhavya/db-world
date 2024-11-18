package com.db.dbworld.controllers;

import com.db.dbworld.payloads.ApiResponse;
import com.db.dbworld.payloads.ResponsePayloads;
import com.db.dbworld.payloads.dbcinema.DBCinemaRecordsDto;
import com.db.dbworld.services.DBCinemaRecordsService;
import com.db.dbworld.utils.DbWorldConstants;
import com.db.dbworld.utils.DbWorldUtils;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import lombok.extern.log4j.Log4j2;
import org.modelmapper.ModelMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageImpl;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

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

    @GetMapping("/record/type/{recordType}")
    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
    public ApiResponse<ResponsePayloads.PaginationRecords> getRecordsByPagination(
            @Valid @NotEmpty @PathVariable("recordType") String recordType,
            @RequestParam(value = "page", required = false, defaultValue = "0") int pageNumber,
            @RequestParam(value = "size", required = false, defaultValue = "12") int pageSize,
            @RequestParam(required = false, defaultValue = "all") String languages
    ){
        if (!recordType.equalsIgnoreCase(DbWorldConstants.RECORD_TYPE_MOVIE) && !recordType.equalsIgnoreCase(DbWorldConstants.RECORD_TYPE_SERIES)) {
            return new ApiResponse<>(HttpStatus.BAD_REQUEST, false, "record type must be movie or series.");
        }
        PageImpl<DBCinemaRecordsDto> page = dbCinemaRecordsService
                .getRecordsByPagination(recordType, pageNumber, pageSize, languages);
        ResponsePayloads.PaginationRecords paginationRecords = new ResponsePayloads.PaginationRecords(
                page.getNumber(),
                page.getSize(),
                page.getTotalElements(),
                page.isEmpty(),
                page.isFirst(),
                page.isLast(),
                page.getContent()
        );
        return new ApiResponse<>(HttpStatus.OK, true, paginationRecords);
    }

    @GetMapping("/record/search")
    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
    public ApiResponse<List<DBCinemaRecordsDto>> searchRecordByKeyword(@RequestParam(value = "q") String query) {
        List<DBCinemaRecordsDto> dbCinemaRecordsDtos = dbCinemaRecordsService.searchRecordByKeyword(query);
        return new ApiResponse<>(HttpStatus.OK, true, dbCinemaRecordsDtos);
    }

    @GetMapping("/record/{recordId}")
    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
    public ApiResponse<DBCinemaRecordsDto> getDbCinemaRecordById(@Valid @PathVariable Long recordId){
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
    public ApiResponse<List<DBCinemaRecordsDto>> getWatchListCinemaRecords(){
        List<DBCinemaRecordsDto> dbCinemaRecordsDtos = dbCinemaRecordsService.getWatchListCinemaRecords();
        return new ApiResponse<>(HttpStatus.OK, true, dbCinemaRecordsDtos);
    }

}
