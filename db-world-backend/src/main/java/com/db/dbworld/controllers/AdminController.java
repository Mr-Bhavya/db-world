package com.db.dbworld.controllers;

import com.db.dbworld.entities.dbcinema.user.UserSearchProjection;
import com.db.dbworld.entities.user.UserActivityLogEntity;
import com.db.dbworld.exceptions.DbWorldException;
import com.db.dbworld.helpers.DbWorldRecords;
import com.db.dbworld.payloads.ApiResponse;
import com.db.dbworld.payloads.RequestPayloads;
import com.db.dbworld.payloads.ResponsePayloads;
import com.db.dbworld.payloads.dbcinema.DBCinemaRecordsDto;
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
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.*;

@Log4j2
@CrossOrigin
@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final UserService userService;
    private final DBCinemaRecordsService dbCinemaRecordsService;
    private final ModelMapper modelMapper;
    private final MediaFileInfoService mediaFileInfoService;
    private final UserActivityLogService logService;

    public AdminController(UserService userService, DBCinemaRecordsService dbCinemaRecordsService, ModelMapper modelMapper, MediaFileInfoService mediaFileInfoService, UserActivityLogService logService) {
        this.userService = userService;
        this.dbCinemaRecordsService = dbCinemaRecordsService;
        this.modelMapper = modelMapper;
        this.mediaFileInfoService = mediaFileInfoService;
        this.logService = logService;
    }

    @GetMapping("/user")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<List<UserDto>> getAllUsers() {
        return ApiResponse.success(userService.getAllUsers());
    }

    @GetMapping("/user/search")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<List<Map<String, Object>>> searchUsers(@RequestParam String query, @RequestParam(defaultValue = "10") int limit) {
        List<UserSearchProjection> users = userService.searchUsersByQuery(query, limit);
        List<Map<String, Object>> result = users.stream().map(u -> {
            Map<String, Object> m = new HashMap<>();
            m.put("firstName", u.getFirstName());
            m.put("lastName", u.getLastName());
            m.put("email", u.getEmail());
            m.put("fullName", u.getFullName());
            return m;
        }).toList();
        return ApiResponse.success(result);
    }

    @PostMapping("/user")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<List<UserDto>> createUser(@RequestBody List<RequestPayloads.UserRequest> users) {
        List<UserDto> dtoList = users.stream().map(u -> modelMapper.map(u, UserDto.class)).toList();
        return ApiResponse.success(HttpStatus.CREATED, userService.createUser(dtoList));
    }

    @PutMapping("/user/{userId}")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<Void> updateUser(@Valid @RequestBody UserDto userDto, @PathVariable Long userId) {
        userService.updateUserWithRole(userDto, userId);
        return ApiResponse.success("User updated successfully");
    }

    @DeleteMapping("/user/{userId}")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<Void> deleteUser(@PathVariable Long userId) {
        userService.deleteUserById(userId);
        return ApiResponse.success("User deleted successfully");
    }

    @GetMapping("/user/userbyemail")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<List<UserDto>> getUserByEmail(@RequestParam String email) {
        return ApiResponse.success(List.of(userService.getUserDtoByEmail(email)));
    }

    @PostMapping("/user/{userId}/role")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<UserDto.UserRole> updateRole(@PathVariable Long userId, @Valid @RequestBody UserDto.UserRole role) {
        return ApiResponse.success(userService.addUpdateUserRoleByUserId(userId, role));
    }

    @PostMapping("/cinema/record")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<DBCinemaRecordsDto> addRecord(@Valid @RequestBody RequestPayloads.AddRecord record) {
        return ApiResponse.success(HttpStatus.CREATED, dbCinemaRecordsService.addRecord(record));
    }

    @GetMapping("/cinema/record")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<Map<String, Object>> getRecords(@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size, @RequestParam(required = false) String search, @RequestParam(required = false) String type, @RequestParam(required = false) String sortBy, @RequestParam(required = false) String sortOrder, @RequestParam(defaultValue = "true") boolean streamList) {
        return ApiResponse.success(dbCinemaRecordsService.getPaginatedRecords(page, size, search, type, sortBy, sortOrder, streamList));
    }

    @PostMapping("/cinema/records")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<Map<String, Object>> bulkAdd(@Valid @RequestBody List<RequestPayloads.AddRecord> records) {
        Map<String, Object> response = new HashMap<>();
        List<Long> success = new ArrayList<>();
        Map<Long, String> failed = new HashMap<>();
        records.forEach(r -> {
            try {
                dbCinemaRecordsService.addRecord(r);
                success.add(r.getTmdbId());
            } catch (Exception e) {
                failed.put(r.getTmdbId(), e.getMessage());
            }
        });
        response.put("success", success);
        response.put("failed", failed);
        return ApiResponse.success(HttpStatus.CREATED, response);
    }

    @PutMapping("/cinema/records")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<DbWorldRecords.TmdbUpdateProcessStatus> updateTmdb(@RequestParam(required = false) Integer limit, @RequestParam(defaultValue = "false") boolean all) {
        if (dbCinemaRecordsService.isRecordsUpdateRunning()) throw new DbWorldException("Update already running");
        dbCinemaRecordsService.updateTmdbWithLatest(limit, all);
        return ApiResponse.success(dbCinemaRecordsService.getStatusOfRecordsUpdate());
    }

    @GetMapping("/cinema/records/status")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<DbWorldRecords.TmdbUpdateProcessStatus> updateStatus() {
        return ApiResponse.success(dbCinemaRecordsService.getStatusOfRecordsUpdate());
    }

    @PutMapping("/cinema/record/{recordId}")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<DBCinemaRecordsDto> updateRecord(@PathVariable Long recordId, @Valid @RequestBody RequestPayloads.AddRecord record) {
        return ApiResponse.success(dbCinemaRecordsService.updateRecord(recordId, record));
    }

    @DeleteMapping("/cinema/record/{recordId}")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<Void> deleteRecord(@PathVariable Long recordId) {
        dbCinemaRecordsService.deleteRecord(recordId);
        return ApiResponse.success("Record deleted");
    }

    @GetMapping("/cinema/record/search")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<List<DbWorldRecords.CinemaRecordDto>> searchCinema(@RequestParam("q") String q) {
        return ApiResponse.success(dbCinemaRecordsService.searchRecordByKeyword(q));
    }

    @GetMapping("/cinema/tmdb/{type}/search")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<List<HashMap<String, Object>>> getTmdbByQuery(@PathVariable("type") String type,
                                                                   @RequestParam("q") String q,
                                                                   @RequestParam(value = "year", required = false, defaultValue = "0") Integer year) {
        return ApiResponse.success(dbCinemaRecordsService.getTmdbByQuery(DbWorldConstants.RECORD_TYE.valueOf(type.toUpperCase()), q, year));
    }

    @DeleteMapping("/stream/media-info/file/{fileIds}")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<Void> deleteMediaInfo(@PathVariable String fileIds) {
        mediaFileInfoService.deleteInfoByIds(Arrays.asList(fileIds.split(",")));
        return ApiResponse.success("Media info deleted");
    }

    @DeleteMapping("/stream/media-info")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<Map<String, Integer>> cleanMedia() {
        return ApiResponse.success(mediaFileInfoService.cleanMediaFileInfo());
    }

    @Transactional
    @GetMapping("/activity-logs")
    public ResponsePayloads.PagedResponse<UserActivityLogDto> activityLogs(@RequestParam(required = false) String username, @RequestParam(required = false) String method, @RequestParam(required = false) Integer status, @RequestParam(required = false) String uri, @RequestParam(required = false) String ip, @RequestParam(required = false) String requestId, @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startDate, @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endDate, @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "10") int size, @RequestParam(defaultValue = "timestamp,desc") String[] sort) {
        PageRequest pr = PageRequest.of(page, size, parseSort(sort));
        Page<UserActivityLogEntity> logs = logService.getFilteredLogs(username, method, status, uri, ip, requestId, startDate, endDate, pr);
        return new ResponsePayloads.PagedResponse<>(logs.map(UserActivityLogDto::new));
    }

    private Sort parseSort(String[] sort) {
        if (sort.length > 1) return Sort.by(Sort.Order.by(sort[0]).with(Sort.Direction.fromString(sort[1])));
        if (sort.length == 1 && sort[0].contains(",")) {
            String[] p = sort[0].split(",");
            return Sort.by(Sort.Order.by(p[0]).with(Sort.Direction.fromString(p[1])));
        }
        return sort.length == 1 ? Sort.by(sort[0]) : Sort.unsorted();
    }
}
