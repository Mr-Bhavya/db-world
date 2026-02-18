package com.db.dbworld.controllers;

import com.db.dbworld.entities.user.UserCinemaActivityEntity;
import com.db.dbworld.entities.user.UserEntity;
import com.db.dbworld.exceptions.DbWorldException;
import com.db.dbworld.payloads.ApiResponse;
import com.db.dbworld.services.user.UserCinemaActivityService;
import com.db.dbworld.services.user.UserService;
import com.db.dbworld.utils.DbWorldConstants;
import lombok.extern.log4j.Log4j2;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Log4j2
@RestController
@RequestMapping("/api/user-cinema-activity")
public class UserCinemaActivityController {

    private final UserCinemaActivityService userCinemaActivityService;
    private final UserService userService;

    public UserCinemaActivityController(UserCinemaActivityService userCinemaActivityService, UserService userService) {
        this.userCinemaActivityService = userCinemaActivityService;
        this.userService = userService;
    }

    private boolean isAdmin(String role) { return "ADMIN".equals(role) || "OWNER".equals(role); }

    private Map<String, Object> toDto(UserCinemaActivityEntity a) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", a.getId());
        m.put("activityType", a.getActivityType().name());
        m.put("activityValue", a.getActivityValue());
        m.put("filePath", a.getFilePath());
        m.put("fileSize", a.getFileSize());
        m.put("bytesTransferred", a.getBytesTransferred());
        m.put("remoteAddr", a.getRemoteAddr());
        m.put("userAgent", a.getUserAgent());
        m.put("createdTime", a.getCreatedTime().toString());
        m.put("lastUpdated", a.getLastUpdated().toString());
        return m;
    }

    private Map<String, Object> toDtoWithUser(UserCinemaActivityEntity a) {
        Map<String, Object> m = toDto(a);
        m.put("userEmail", a.getUser().getEmail());
        return m;
    }

    @GetMapping("/admin/all-recent")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<Map<String, Object>> getAllRecentActivities(@RequestParam(defaultValue = "100") Integer limit, @RequestParam(required = false) String activityType, @RequestParam(defaultValue = "24") Long hours) {
        String role = userService.getRoleForUser().getName();
        if (!isAdmin(role)) throw new DbWorldException("Admin access required");
        Instant cutoff = Instant.now().minus(hours, ChronoUnit.HOURS);
        List<UserCinemaActivityEntity> list = activityType != null ? userCinemaActivityService.getAllRecentActivitiesByType(UserCinemaActivityEntity.ActivityType.valueOf(activityType.toUpperCase()), cutoff, limit) : userCinemaActivityService.getAllRecentActivities(cutoff, limit);
        Map<String, Object> r = new HashMap<>();
        r.put("type", "all_recent_activities");
        r.put("activities", list.stream().map(this::toDtoWithUser).toList());
        r.put("count", list.size());
        r.put("timestamp", Instant.now().toString());
        return ApiResponse.success(r);
    }

    @GetMapping("/admin/user-activities")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<Map<String, Object>> getUserActivities(@RequestParam String userEmail, @RequestParam(defaultValue = "50") Integer limit, @RequestParam(required = false) String activityType, @RequestParam(defaultValue = "24") Long hours) {
        String role = userService.getRoleForUser().getName();
        if (!isAdmin(role)) throw new DbWorldException("Admin access required");
        UserEntity u = userService.getUserEntityByEmail(userEmail);
        if (u == null) throw new DbWorldException("User not found: " + userEmail);
        Instant cutoff = Instant.now().minus(hours, ChronoUnit.HOURS);
        List<UserCinemaActivityEntity> list = activityType != null ? userCinemaActivityService.getRecentActivitiesByType(u, UserCinemaActivityEntity.ActivityType.valueOf(activityType.toUpperCase()), cutoff, limit) : userCinemaActivityService.getRecentActivities(u, cutoff, limit);
        Map<String, Object> r = new HashMap<>();
        r.put("type", "user_activities");
        r.put("userEmail", userEmail);
        r.put("activities", list.stream().map(this::toDto).toList());
        r.put("count", list.size());
        r.put("timestamp", Instant.now().toString());
        return ApiResponse.success(r);
    }

    @GetMapping("/admin/activity-stats")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<Map<String, Object>> getActivityStats(@RequestParam(defaultValue = "7") Long days) {
        String role = userService.getRoleForUser().getName();
        if (!isAdmin(role)) throw new DbWorldException("Admin access required");
        Instant cutoff = Instant.now().minus(days, ChronoUnit.DAYS);
        Map<String, Object> r = new HashMap<>();
        r.put("type", "activity_stats_all");
        r.put("stats", userCinemaActivityService.getActivityStatsAll(cutoff));
        r.put("period_days", days);
        r.put("timestamp", Instant.now().toString());
        return ApiResponse.success(r);
    }

    @GetMapping("/admin/user-list")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<Map<String, Object>> getUserList(@RequestParam(defaultValue = "24") Long hours) {
        String role = userService.getRoleForUser().getName();
        if (!isAdmin(role)) throw new DbWorldException("Admin access required");
        Instant cutoff = Instant.now().minus(hours, ChronoUnit.HOURS);
        Map<String, Object> r = new HashMap<>();
        r.put("type", "user_list");
        r.put("users", userCinemaActivityService.getActiveUsersWithStats(cutoff));
        r.put("count", ((List<?>) r.get("users")).size());
        r.put("period_hours", hours);
        r.put("timestamp", Instant.now().toString());
        return ApiResponse.success(r);
    }

    @GetMapping("/admin/dashboard-stats")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<Map<String, Object>> getDashboardStats(@RequestParam(defaultValue = "7") Long days) {
        String role = userService.getRoleForUser().getName();
        if (!isAdmin(role)) throw new DbWorldException("Admin access required");
        Instant cutoff = Instant.now().minus(days, ChronoUnit.DAYS);
        Map<String, Object> r = new HashMap<>();
        r.put("type", "dashboard_stats");
        r.put("stats", userCinemaActivityService.getDashboardStats(cutoff));
        r.put("period_days", days);
        r.put("timestamp", Instant.now().toString());
        return ApiResponse.success(r);
    }

    @GetMapping("/user/my-activities")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<Map<String, Object>> getMyActivities(@RequestParam(defaultValue = "50") Integer limit, @RequestParam(required = false) String activityType, @RequestParam(defaultValue = "24") Long hours) {
        String email = userService.getUserFromToken().getEmail();
        UserEntity u = userService.getUserEntityByEmail(email);
        if (u == null) throw new DbWorldException("User not found");
        Instant cutoff = Instant.now().minus(hours, ChronoUnit.HOURS);
        List<UserCinemaActivityEntity> list = activityType != null ? userCinemaActivityService.getRecentActivitiesByType(u, UserCinemaActivityEntity.ActivityType.valueOf(activityType.toUpperCase()), cutoff, limit) : userCinemaActivityService.getRecentActivities(u, cutoff, limit);
        Map<String, Object> r = new HashMap<>();
        r.put("type", "my_activities");
        r.put("activities", list.stream().map(this::toDto).toList());
        r.put("count", list.size());
        r.put("timestamp", Instant.now().toString());
        return ApiResponse.success(r);
    }

    @GetMapping("/initial-data")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<Map<String, Object>> getInitialData() {
        String role = userService.getRoleForUser().getName();
        Map<String, Object> r = new HashMap<>();
        r.put("type", "initial_data");
        r.put("userRole", role);
        r.put("timestamp", Instant.now().toString());
        if (isAdmin(role)) {
            Instant cutoff = Instant.now().minus(24, ChronoUnit.HOURS);
            Map<String, Object> admin = new HashMap<>();
            admin.put("totalActivities", userCinemaActivityService.getTotalActivitiesCount(cutoff));
            admin.put("activeUsers", userCinemaActivityService.getActiveUsersCount(cutoff));
            r.put("adminData", admin);
        }
        return ApiResponse.success(r);
    }
}
