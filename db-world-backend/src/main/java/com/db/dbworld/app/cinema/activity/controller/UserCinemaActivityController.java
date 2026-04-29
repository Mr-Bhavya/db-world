package com.db.dbworld.app.cinema.activity.controller;

import com.db.dbworld.audit.activity.entity.UserCinemaActivityEntity;
import com.db.dbworld.core.exception.DbWorldException;
import com.db.dbworld.core.user.entity.UserEntity;
import com.db.dbworld.audit.activity.service.UserCinemaActivityService;
import com.db.dbworld.core.context.UserContext;
import com.db.dbworld.core.user.service.UserService;
import com.db.dbworld.api.response.ApiResponse;
import com.db.dbworld.config.AppConstants;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * REST endpoints for cinema activity monitoring.
 * Migrated from com.db.dbworld.controllers.UserCinemaActivityController.
 */
@Log4j2
@RestController
@RequestMapping("/api/user-cinema-activity")
@RequiredArgsConstructor
public class UserCinemaActivityController {

    private final UserCinemaActivityService userCinemaActivityService;
    private final UserService userService;
    private final UserContext userContext;

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Admin endpoints
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    @GetMapping("/admin/all-recent")
    @PreAuthorize(AppConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<Map<String, Object>> getAllRecentActivities(
            @RequestParam(defaultValue = "100") Integer limit,
            @RequestParam(required = false)     String activityType,
            @RequestParam(defaultValue = "24")  Long hours) {

        Instant cutoff = Instant.now().minus(hours, ChronoUnit.HOURS);
        List<UserCinemaActivityEntity> list = activityType != null
                ? userCinemaActivityService.getAllRecentActivitiesByType(
                        UserCinemaActivityEntity.ActivityType.valueOf(activityType.toUpperCase()), cutoff, limit)
                : userCinemaActivityService.getAllRecentActivities(cutoff, limit);

        Map<String, Object> r = new HashMap<>();
        r.put("type",       "all_recent_activities");
        r.put("activities", list.stream().map(this::toDtoWithUser).toList());
        r.put("count",      list.size());
        r.put("timestamp",  Instant.now().toString());
        return ApiResponse.success(r);
    }

    @GetMapping("/admin/user-activities")
    @PreAuthorize(AppConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<Map<String, Object>> getUserActivities(
            @RequestParam                       String userEmail,
            @RequestParam(defaultValue = "50")  Integer limit,
            @RequestParam(required = false)     String activityType,
            @RequestParam(defaultValue = "24")  Long hours) {

        UserEntity u = userService.getUserEntityByEmail(userEmail);
        if (u == null) throw new DbWorldException("User not found: " + userEmail);

        Instant cutoff = Instant.now().minus(hours, ChronoUnit.HOURS);
        List<UserCinemaActivityEntity> list = activityType != null
                ? userCinemaActivityService.getRecentActivitiesByType(
                        u, UserCinemaActivityEntity.ActivityType.valueOf(activityType.toUpperCase()), cutoff, limit)
                : userCinemaActivityService.getRecentActivities(u, cutoff, limit);

        Map<String, Object> r = new HashMap<>();
        r.put("type",       "user_activities");
        r.put("userEmail",  userEmail);
        r.put("activities", list.stream().map(this::toDto).toList());
        r.put("count",      list.size());
        r.put("timestamp",  Instant.now().toString());
        return ApiResponse.success(r);
    }

    @GetMapping("/admin/activity-stats")
    @PreAuthorize(AppConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<Map<String, Object>> getActivityStats(
            @RequestParam(defaultValue = "7") Long days) {

        Instant cutoff = Instant.now().minus(days, ChronoUnit.DAYS);
        Map<String, Object> r = new HashMap<>();
        r.put("type",        "activity_stats_all");
        r.put("stats",       userCinemaActivityService.getActivityStatsAll(cutoff));
        r.put("period_days", days);
        r.put("timestamp",   Instant.now().toString());
        return ApiResponse.success(r);
    }

    @GetMapping("/admin/user-list")
    @PreAuthorize(AppConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<Map<String, Object>> getUserList(
            @RequestParam(defaultValue = "24") Long hours) {

        Instant cutoff = Instant.now().minus(hours, ChronoUnit.HOURS);
        List<Map<String, Object>> users = userCinemaActivityService.getActiveUsersWithStats(cutoff);
        Map<String, Object> r = new HashMap<>();
        r.put("type",         "user_list");
        r.put("users",        users);
        r.put("count",        users.size());
        r.put("period_hours", hours);
        r.put("timestamp",    Instant.now().toString());
        return ApiResponse.success(r);
    }

    @GetMapping("/admin/dashboard-stats")
    @PreAuthorize(AppConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<Map<String, Object>> getDashboardStats(
            @RequestParam(defaultValue = "7") Long days) {

        Instant cutoff = Instant.now().minus(days, ChronoUnit.DAYS);
        Map<String, Object> r = new HashMap<>();
        r.put("type",        "dashboard_stats");
        r.put("stats",       userCinemaActivityService.getDashboardStats(cutoff));
        r.put("period_days", days);
        r.put("timestamp",   Instant.now().toString());
        return ApiResponse.success(r);
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // User endpoints
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    @GetMapping("/user/my-activities")
    @PreAuthorize(AppConstants.ALL_AUTHORIZE)
    public ApiResponse<Map<String, Object>> getMyActivities(
            @RequestParam(defaultValue = "50") Integer limit,
            @RequestParam(required = false)    String activityType,
            @RequestParam(defaultValue = "24") Long hours) {

        UserEntity u = userService.getUserEntityById(userContext.userId());
        if (u == null) throw new DbWorldException("User not found");

        Instant cutoff = Instant.now().minus(hours, ChronoUnit.HOURS);
        List<UserCinemaActivityEntity> list = activityType != null
                ? userCinemaActivityService.getRecentActivitiesByType(
                        u, UserCinemaActivityEntity.ActivityType.valueOf(activityType.toUpperCase()), cutoff, limit)
                : userCinemaActivityService.getRecentActivities(u, cutoff, limit);

        Map<String, Object> r = new HashMap<>();
        r.put("type",       "my_activities");
        r.put("activities", list.stream().map(this::toDto).toList());
        r.put("count",      list.size());
        r.put("timestamp",  Instant.now().toString());
        return ApiResponse.success(r);
    }

    @GetMapping("/initial-data")
    @PreAuthorize(AppConstants.ALL_AUTHORIZE)
    public ApiResponse<Map<String, Object>> getInitialData() {
        String role = userService.getRoleForUser();
        Map<String, Object> r = new HashMap<>();
        r.put("type",      "initial_data");
        r.put("userRole",  role);
        r.put("timestamp", Instant.now().toString());

        if (isAdmin(role)) {
            Instant cutoff = Instant.now().minus(24, ChronoUnit.HOURS);
            Map<String, Object> admin = new HashMap<>();
            admin.put("totalActivities", userCinemaActivityService.getTotalActivitiesCount(cutoff));
            admin.put("activeUsers",     userCinemaActivityService.getActiveUsersCount(cutoff));
            r.put("adminData", admin);
        }
        return ApiResponse.success(r);
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Helpers
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    private boolean isAdmin(String role) {
        return "ADMIN".equals(role) || "OWNER".equals(role);
    }

    private Map<String, Object> toDto(UserCinemaActivityEntity a) {
        Map<String, Object> m = new HashMap<>();
        m.put("id",               a.getId());
        m.put("activityType",     a.getActivityType().name());
        m.put("activityValue",    a.getActivityValue());
        m.put("filePath",         a.getFilePath());
        m.put("fileSize",         a.getFileSize());
        m.put("bytesTransferred", a.getBytesTransferred());
        m.put("remoteAddr",       a.getRemoteAddr());
        m.put("userAgent",        a.getUserAgent());
        m.put("createdTime",      a.getCreatedTime().toString());
        m.put("lastUpdated",      a.getLastUpdated().toString());
        return m;
    }

    private Map<String, Object> toDtoWithUser(UserCinemaActivityEntity a) {
        Map<String, Object> m = toDto(a);
        m.put("userEmail", a.getUser().getEmail());
        return m;
    }
}
