package com.db.dbworld.controllers;

import com.db.dbworld.entities.dbcinema.user.UserSearchProjection;
import com.db.dbworld.entities.user.UserActivityLogEntity;
import com.db.dbworld.exceptions.DbWorldException;
import com.db.dbworld.helpers.DbWorldRecords;
import com.db.dbworld.helpers.TmdbUpdateStatusTracker;
import com.db.dbworld.payloads.ApiResponse;
import com.db.dbworld.payloads.RequestPayloads;
import com.db.dbworld.payloads.ResponsePayloads;
import com.db.dbworld.payloads.dbcinema.DBCinemaRecordsDto;
import com.db.dbworld.payloads.dbcinema.stream.MediaFileInfo;
import com.db.dbworld.payloads.user.UserActivityLogDto;
import com.db.dbworld.payloads.user.UserDto;
import com.db.dbworld.services.cinema.DBCinemaRecordsService;
import com.db.dbworld.services.media.MediaFileInfoService;
import com.db.dbworld.services.user.UserActivityLogService;
import com.db.dbworld.services.user.UserService;
import com.db.dbworld.utils.DbWorldConstants;
import jakarta.validation.Valid;
import lombok.extern.log4j.Log4j2;
import org.modelmapper.ModelMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Log4j2
@CrossOrigin
@RestController
@RequestMapping(("/api/admin"))
public class AdminController {

    @Autowired
    private UserService userService;

    @Autowired
    private DBCinemaRecordsService dbCinemaRecordsService;

    @Autowired
    private ModelMapper modelMapper;

    @Autowired
    private MediaFileInfoService mediaFileInfoService;

    @Autowired
    private UserActivityLogService logService;

    @GetMapping("/user")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<List<UserDto>> getAllUsers() {
        List<UserDto> userDtoList = this.userService.getAllUsers();
        return new ApiResponse<>(HttpStatus.OK, true, userDtoList);
    }

    @GetMapping("/user/search")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<List<Map<String, Object>>> getUserByQuery(@RequestParam String query,
                                                                 @RequestParam(defaultValue = "10") int limit) {
        List<UserSearchProjection> users = this.userService.searchUsersByQuery(query, limit);

        // Convert projection to a list of maps
        List<Map<String, Object>> mappedUsers = users.stream().map(user -> {
            Map<String, Object> map = new HashMap<>();
            map.put("firstName", user.getFirstName());
            map.put("lastName", user.getLastName());
            map.put("email", user.getEmail());
            map.put("fullName", user.getFullName());
            return map;
        }).toList();

        return new ApiResponse<>(HttpStatus.OK, true, mappedUsers);
    }

    @PostMapping("/user")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<List<UserDto>> createUser(List<RequestPayloads.UserRequest> userRequestList) {
        List<UserDto> userDtoList = userRequestList.stream().map(userRequest -> modelMapper.map(userRequest, UserDto.class)).collect(Collectors.toList());
        List<UserDto> createdUsers = this.userService.createUser(userDtoList);
        return new ApiResponse<>(HttpStatus.CREATED, true, createdUsers);
    }

    @PutMapping("/user/{userId}")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<String> updateUser(@Valid
                                          @RequestBody UserDto userDto,
                                          @PathVariable(value = "userId") Long userId) {
        this.userService.updateUserWithRole(userDto, userId);
        String message = "User with userId " + userId + " is updated successfully.";
        return new ApiResponse<>(HttpStatus.OK, true, message);
    }

    @DeleteMapping("/user/{userId}")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<String> deleteUser(@PathVariable(value = "userId") Long userId) {
        this.userService.deleteUserById(userId);
        String message = "User with userId " + userId + " is deleted successfully.";
        return new ApiResponse<>(HttpStatus.OK, true, message);
    }

    @GetMapping("/user/userbyemail")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<List<UserDto>> getUserByEmail(@RequestParam(value = "email") String email) {
        UserDto userDto = this.userService.getUserDtoByEmail(email);
        return new ApiResponse<>(HttpStatus.OK, true, Arrays.stream(new UserDto[]{userDto}).toList());
    }

    @PostMapping("/user/{userId}/role")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<UserDto.UserRole> addUpdateUserRoleByUserId(@PathVariable Long userId, @RequestBody @Valid UserDto.UserRole role) {
        UserDto.UserRole updatedUserRole = this.userService.addUpdateUserRoleByUserId(userId, role);
        return new ApiResponse<>(HttpStatus.OK, true, updatedUserRole);
    }

    @PostMapping("/cinema/record")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<DBCinemaRecordsDto> addDBCinemaRecord(@Valid @RequestBody RequestPayloads.AddRecord record) {
        DBCinemaRecordsDto newDBDbCinemaRecordsDto = dbCinemaRecordsService.addRecord(record);
        return new ApiResponse<>(HttpStatus.CREATED, true, newDBDbCinemaRecordsDto);
    }

    @GetMapping("/cinema/record")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<Map<String, Object>> getDbCinemaRecords(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String sortBy,
            @RequestParam(required = false) String sortOrder,
            @RequestParam(value = "streamList", defaultValue = "true") boolean streamList) {

        try {
            log.info("Fetching cinema records - page: {}, size: {}, search: {}, type: {}, sortBy: {}, sortOrder: {}",
                    page, size, search, type, sortBy, sortOrder);

            Map<String, Object> response = dbCinemaRecordsService.getPaginatedRecords(
                    page, size, search, type, sortBy, sortOrder, streamList);

            return new ApiResponse<>(HttpStatus.OK, true, "Records fetched successfully", response);

        } catch (Exception e) {
            log.error("Error fetching cinema records", e);
            return new ApiResponse<>(HttpStatus.INTERNAL_SERVER_ERROR, false,
                    "Error fetching records: " + e.getMessage(), null);
        }
    }


    @PostMapping("/cinema/records")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<Map<String, Object>> addDBCinemaRecord(@Valid @RequestBody List<RequestPayloads.AddRecord> records) {

        List<DBCinemaRecordsDto> dbCinemaRecordsDtos = new ArrayList<>();
        Map<Long, String> failedIds = new HashMap<>();
        List<Long> successIds = new ArrayList<>();
        Map<String, Object> response = new HashMap<>();

        records.forEach(
                record -> {
                    try {
                        DBCinemaRecordsDto newDBDbCinemaRecordsDto = dbCinemaRecordsService.addRecord(record);
                        dbCinemaRecordsDtos.add(newDBDbCinemaRecordsDto);
                        successIds.add(record.getTmdbId());
                        log.info("Completed - {} Last TMDB: {}", dbCinemaRecordsDtos.size(), record.getTmdbId());
                        Thread.sleep(500);
                    } catch (Exception ex) {
                        failedIds.put(record.getTmdbId(), ex.getMessage());
                        log.error("Failed ID: {} Error Message: {}", record.getTmdbId(), ex.getMessage());
                    }
                }
        );

        response.put("success", successIds);
        response.put("failed", failedIds);
        return new ApiResponse<>(HttpStatus.CREATED, true, response);
    }

    @PutMapping("/cinema/records")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<DbWorldRecords.TmdbUpdateProcessStatus> updateTmdbWithLatest(
            @RequestParam(required = false) Integer limit,
            @RequestParam(required = false, defaultValue = "false") boolean all) {

        if (dbCinemaRecordsService.isRecordsUpdateRunning()) {
            throw new DbWorldException(HttpStatus.ALREADY_REPORTED, "Updating records is already running");
        }

        dbCinemaRecordsService.updateTmdbWithLatest(limit, all);
        return new ApiResponse<>(HttpStatus.OK, true, "Records update started",
                dbCinemaRecordsService.getStatusOfRecordsUpdate());
    }

    @PostMapping("/cinema/records/cancel-update")
    public ResponseEntity<?> cancelUpdateTmdbWithLatest() {
        dbCinemaRecordsService.cancelUpdateTmdbWithLatest();
        return ResponseEntity.ok().build();
    }

    @GetMapping("/cinema/records/status")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<DbWorldRecords.TmdbUpdateProcessStatus> getUpdateStatus() {
        return new ApiResponse<>(HttpStatus.OK, true, "Current process status",
                dbCinemaRecordsService.getStatusOfRecordsUpdate());
    }

    @PutMapping("/cinema/record/{recordId}")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<DBCinemaRecordsDto> updateDbCinemaRecordById(
            @Valid @PathVariable Long recordId,
            @Valid @RequestBody RequestPayloads.AddRecord record
    ) {
        DBCinemaRecordsDto updatedDbCinemaRecordsDto = dbCinemaRecordsService.updateRecord(recordId, record);
        return new ApiResponse<>(HttpStatus.OK, true, updatedDbCinemaRecordsDto);
    }

    @PutMapping("/cinema/record/{recordId}/showOnTop={showOnTop}")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<DBCinemaRecordsDto> switchShowOnTopRecord(
            @Valid @PathVariable Long recordId,
            @Valid @PathVariable boolean showOnTop
    ) {
        dbCinemaRecordsService.switchShowOnTopRecord(recordId, showOnTop);
        return new ApiResponse<>(HttpStatus.OK, true, "Record Id: " + recordId + " is updated successfully.");
    }

    @DeleteMapping("/cinema/record/{recordId}")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<String> deleteDBCinemaRecord(@Valid @PathVariable Long recordId) {
        dbCinemaRecordsService.deleteRecord(recordId);
        return new ApiResponse<>(HttpStatus.OK, true, "Record deleted.");
    }

    @GetMapping("/cinema/record/search")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<List<DbWorldRecords.CinemaRecordDto>> searchRecordByKeyword(@RequestParam(value = "q") String query) {
        List<DbWorldRecords.CinemaRecordDto> dbCinemaRecords = dbCinemaRecordsService.searchRecordByKeyword(query);
        return new ApiResponse<>(HttpStatus.OK, true, dbCinemaRecords);
    }

    @GetMapping("/cinema/tmdb/{type}/search")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<List<HashMap<String, Object>>> searchTmdbByKeyword(
            @PathVariable String type,
            @RequestParam("q") String query,
            @RequestParam(value = "year", required = false, defaultValue = "0") Integer year
    ) {
        List<HashMap<String, Object>> list = this.dbCinemaRecordsService.getTmdbByQuery(type, query, year);
        return new ApiResponse<>(HttpStatus.OK, true, list);
    }


    @DeleteMapping(value = "/stream/media-info/file/{fileIds}")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<List<MediaFileInfo>> deleteMediaInfoByFileId(@PathVariable(value = "fileIds") String fileIds) {
        mediaFileInfoService.deleteInfoByIds(Arrays.stream(fileIds.split(",")).toList());
        return new ApiResponse<>(HttpStatus.OK, true, "File info deleted successfully.");
    }

    @DeleteMapping(value = "/stream/media-info")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<Map<String, Integer>> cleanMediaFileInfo() {
        Map<String, Integer> response = mediaFileInfoService.cleanMediaFileInfo();
        return new ApiResponse<>(HttpStatus.OK, true, response);
    }

    @Transactional
    @GetMapping("/activity-logs")
    public ResponseEntity<ResponsePayloads.PagedResponse<UserActivityLogDto>> getActivityLogs(
            @RequestParam(required = false) String username,
            @RequestParam(required = false) String method,
            @RequestParam(required = false) Integer status,
            @RequestParam(required = false) String uri,
            @RequestParam(required = false) String ip,
            @RequestParam(required = false) String requestId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endDate,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "timestamp,desc") String[] sort) {

        PageRequest pageRequest = PageRequest.of(page, size, parseSort(sort));
        Page<UserActivityLogEntity> logs = logService.getFilteredLogs(
                username, method, status, uri, ip, requestId, startDate, endDate, pageRequest
        );

        // Convert to DTO page
        ResponsePayloads.PagedResponse<UserActivityLogDto> dtoPage = new ResponsePayloads.PagedResponse<>(logs.map(UserActivityLogDto::new));

        return ResponseEntity.ok(dtoPage);
    }

    private Sort parseSort(String[] sort) {
        if (sort.length > 1) {
            return Sort.by(Sort.Order.by(sort[0]).with(Sort.Direction.fromString(sort[1])));
        } else if (sort.length == 1) {
            // Handle default direction if only field is provided
            String[] parts = sort[0].split(",");
            if (parts.length > 1) {
                return Sort.by(Sort.Order.by(parts[0]).with(Sort.Direction.fromString(parts[1])));
            }
            return Sort.by(Sort.Order.asc(parts[0]));
        }
        return Sort.unsorted();
    }

}
