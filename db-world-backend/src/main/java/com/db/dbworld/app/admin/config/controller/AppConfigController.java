package com.db.dbworld.app.admin.config.controller;

import com.db.dbworld.api.response.ApiResponse;
import com.db.dbworld.app.admin.config.dto.SettingCategoryDto;
import com.db.dbworld.app.admin.config.dto.SettingDto;
import com.db.dbworld.app.admin.config.service.SettingsService;
import com.db.dbworld.core.role.annotations.AdminAccess;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@Log4j2
@RestController
@RequestMapping("/api/admin/config")
@RequiredArgsConstructor
public class AppConfigController {

    private final SettingsService settingsService;

    @GetMapping
    @AdminAccess
    public ApiResponse<List<SettingCategoryDto>> list() {
        return ApiResponse.success(settingsService.listGrouped());
    }

    @PutMapping("/{key}")
    @AdminAccess
    public ApiResponse<SettingDto> update(@PathVariable String key,
                                          @RequestBody Map<String, String> body) {
        String value = body.get("value");
        try {
            var updated = settingsService.update(key, value, currentUser());
            return ApiResponse.success(settingsService.toDto(updated));
        } catch (IllegalArgumentException ex) {
            log.warn("Config update rejected for {}: {}", key, ex.getMessage());
            return ApiResponse.error(HttpStatus.BAD_REQUEST, ex.getMessage(), (SettingDto) null);
        }
    }

    @PostMapping("/{key}/reset")
    @AdminAccess
    public ApiResponse<SettingDto> reset(@PathVariable String key) {
        try {
            var reset = settingsService.reset(key, currentUser());
            return ApiResponse.success(settingsService.toDto(reset));
        } catch (IllegalArgumentException ex) {
            return ApiResponse.error(HttpStatus.BAD_REQUEST, ex.getMessage(), (SettingDto) null);
        }
    }

    /** Best-effort current username for the audit column. */
    private static String currentUser() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        return (auth != null && auth.getName() != null) ? auth.getName() : "admin";
    }
}
