package com.db.dbworld.controllers;

import com.db.dbworld.exceptions.DbWorldException;
import com.db.dbworld.payloads.ApiResponse;
import com.db.dbworld.payloads.RequestPayloads;
import com.db.dbworld.payloads.dbcinema.DBCinemaRecordsDto;
import com.db.dbworld.payloads.user.UserDto;
import com.db.dbworld.services.DBCinemaRecordsService;
import com.db.dbworld.services.UserService;
import com.db.dbworld.utils.DbWorldConstants;
import jakarta.validation.Valid;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@Log4j2
@CrossOrigin
@RestController
@RequestMapping(("/api/admin"))
public class AdminController {

    @Autowired
    private UserService userService;

    @Autowired
    private DBCinemaRecordsService dbCinemaRecordsService;

    @GetMapping("/user")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<List<UserDto>> getAllUsers() {
        List<UserDto> userDtoList = this.userService.getAllUsers();
        return new ApiResponse<>(HttpStatus.OK, true, userDtoList);
    }

    @PostMapping("/user")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<List<UserDto>> createUser(@Valid @RequestBody List<UserDto> userDtoList) {
        List<UserDto> createdUsers = this.userService.createUser(userDtoList);
        return new ApiResponse<>(HttpStatus.CREATED, true, createdUsers);
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
        UserDto userDto = this.userService.getUserByEmail(email);
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
                    }catch (Exception ex){
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
    public ApiResponse<Map<String, Object>> updateTmdbWithLatest (){
        if(this.dbCinemaRecordsService.getStatusOfRecordsUpdate().containsKey("running") && (Boolean) this.dbCinemaRecordsService.getStatusOfRecordsUpdate().get("running")){
            throw new DbWorldException(HttpStatus.ALREADY_REPORTED, "Updating records is already running");
        }
        this.dbCinemaRecordsService.updateTmdbWithLatest();
        return new ApiResponse<>(HttpStatus.OK, true, "Records is updating." ,this.dbCinemaRecordsService.getStatusOfRecordsUpdate());
    }

    @PutMapping("/cinema/record/{recordId}")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<DBCinemaRecordsDto> updateDbCinemaRecordById(
            @Valid @PathVariable Long recordId,
            @Valid @RequestBody RequestPayloads.AddRecord record
    ){
        DBCinemaRecordsDto updatedDbCinemaRecordsDto = dbCinemaRecordsService.updateRecord(recordId, record);
        return new ApiResponse<>(HttpStatus.OK, true, updatedDbCinemaRecordsDto);
    }

    @DeleteMapping("/cinema/record/{recordId}")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<String> deleteDBCinemaRecord(@Valid @PathVariable Long recordId) {
        dbCinemaRecordsService.deleteRecord(recordId);
        return new ApiResponse<>(HttpStatus.OK, true, "Record deleted.");
    }

    @GetMapping("/cinema/tmdb/{type}/search")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<List<HashMap<String, Object>>> searchTmdbByKeyword(
            @PathVariable String type,
            @RequestParam("q") String query,
            @RequestParam(value = "year", required = false, defaultValue = "0") Integer year
    ){
        List<HashMap<String, Object>> list = this.dbCinemaRecordsService.getTmdbByQuery(type, query, year);
        return new ApiResponse<>(HttpStatus.OK, true, list);
    }

    @GetMapping("/cinema/records/status")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<Map<String, Object>> getStatusOfRecordUpdate(){
        Map<String, Object> map = this.dbCinemaRecordsService.getStatusOfRecordsUpdate();
        return new ApiResponse<>(HttpStatus.OK, true, map);
    }

}
