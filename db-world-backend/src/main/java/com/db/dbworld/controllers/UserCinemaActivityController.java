package com.db.dbworld.controllers;

import com.db.dbworld.utils.DbWorldConstants;
import lombok.extern.log4j.Log4j2;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.db.dbworld.entities.user.UserCinemaActivityEntity;
import com.db.dbworld.entities.user.UserEntity;
import com.db.dbworld.services.user.UserCinemaActivityService;
import com.db.dbworld.services.user.UserService;
import org.springframework.http.ResponseEntity;
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

    public UserCinemaActivityController(UserCinemaActivityService userCinemaActivityService,
                                        UserService userService) {
        this.userCinemaActivityService = userCinemaActivityService;
        this.userService = userService;
    }

    // Helper method to check admin role
    private boolean isAdmin(String role) {
        return "ADMIN".equals(role) || "OWNER".equals(role);
    }

    // Convert entity to DTO
    private Map<String, Object> convertActivityToDto(UserCinemaActivityEntity activity) {
        Map<String, Object> dto = new HashMap<>();
        dto.put("id", activity.getId());
        dto.put("activityType", activity.getActivityType().name());
        dto.put("activityValue", activity.getActivityValue());
        dto.put("filePath", activity.getFilePath());
        dto.put("fileSize", activity.getFileSize());
        dto.put("bytesTransferred", activity.getBytesTransferred());
        dto.put("remoteAddr", activity.getRemoteAddr());
        dto.put("userAgent", activity.getUserAgent());
        dto.put("createdTime", activity.getCreatedTime().toString());
        dto.put("lastUpdated", activity.getLastUpdated().toString());
        return dto;
    }

    private Map<String, Object> convertActivityToDtoWithUser(UserCinemaActivityEntity activity) {
        Map<String, Object> dto = convertActivityToDto(activity);
        dto.put("userEmail", activity.getUser().getEmail());
        return dto;
    }

    // ADMIN ENDPOINTS

    @GetMapping("/admin/all-recent")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ResponseEntity<?> getAllRecentActivities(
            @RequestParam(defaultValue = "100") Integer limit,
            @RequestParam(required = false) String activityType,
            @RequestParam(defaultValue = "24") Long hours) {

        try {
            String userRole = userService.getRoleForUser().getName();
            if (!isAdmin(userRole)) {
                return ResponseEntity.status(403).body(Map.of(
                        "error", "Access denied. Admin role required.",
                        "timestamp", Instant.now().toString()
                ));
            }

            Instant cutoffTime = Instant.now().minus(hours, ChronoUnit.HOURS);
            List<UserCinemaActivityEntity> activities;

            if (activityType != null) {
                UserCinemaActivityEntity.ActivityType type =
                        UserCinemaActivityEntity.ActivityType.valueOf(activityType.toUpperCase());
                activities = userCinemaActivityService.getAllRecentActivitiesByType(type, cutoffTime, limit);
            } else {
                activities = userCinemaActivityService.getAllRecentActivities(cutoffTime, limit);
            }

            Map<String, Object> response = new HashMap<>();
            response.put("type", "all_recent_activities");
            response.put("activities", activities.stream()
                    .map(this::convertActivityToDtoWithUser)
                    .toList());
            response.put("count", activities.size());
            response.put("timestamp", Instant.now().toString());

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Error getting all recent activities: {}", e.getMessage(), e);
            return ResponseEntity.status(500).body(Map.of(
                    "error", "Failed to get all recent activities",
                    "timestamp", Instant.now().toString()
            ));
        }
    }

    @GetMapping("/admin/user-activities")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ResponseEntity<?> getUserActivities(
            @RequestParam String userEmail,
            @RequestParam(defaultValue = "50") Integer limit,
            @RequestParam(required = false) String activityType,
            @RequestParam(defaultValue = "24") Long hours) {

        try {
            String userRole = userService.getRoleForUser().getName();
            if (!isAdmin(userRole)) {
                return ResponseEntity.status(403).body(Map.of(
                        "error", "Access denied. Admin role required.",
                        "timestamp", Instant.now().toString()
                ));
            }

            Instant cutoffTime = Instant.now().minus(hours, ChronoUnit.HOURS);
            UserEntity targetUser = userService.getUserEntityByEmail(userEmail);

            if (targetUser == null) {
                return ResponseEntity.status(404).body(Map.of(
                        "error", "User not found: " + userEmail,
                        "timestamp", Instant.now().toString()
                ));
            }

            List<UserCinemaActivityEntity> activities;

            if (activityType != null) {
                UserCinemaActivityEntity.ActivityType type =
                        UserCinemaActivityEntity.ActivityType.valueOf(activityType.toUpperCase());
                activities = userCinemaActivityService.getRecentActivitiesByType(targetUser, type, cutoffTime, limit);
            } else {
                activities = userCinemaActivityService.getRecentActivities(targetUser, cutoffTime, limit);
            }

            Map<String, Object> response = new HashMap<>();
            response.put("type", "user_activities");
            response.put("userEmail", userEmail);
            response.put("activities", activities.stream()
                    .map(this::convertActivityToDto)
                    .toList());
            response.put("count", activities.size());
            response.put("timestamp", Instant.now().toString());

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Error getting user activities for {}: {}", userEmail, e.getMessage(), e);
            return ResponseEntity.status(500).body(Map.of(
                    "error", "Failed to get user activities",
                    "timestamp", Instant.now().toString()
            ));
        }
    }

    @GetMapping("/admin/activity-stats")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ResponseEntity<?> getActivityStatsAll(
            @RequestParam(defaultValue = "7") Long days) {

        try {
            String userRole = userService.getRoleForUser().getName();
            if (!isAdmin(userRole)) {
                return ResponseEntity.status(403).body(Map.of(
                        "error", "Access denied. Admin role required.",
                        "timestamp", Instant.now().toString()
                ));
            }

            Instant cutoffTime = Instant.now().minus(days, ChronoUnit.DAYS);
            Map<UserCinemaActivityEntity.ActivityType, Long> stats =
                    userCinemaActivityService.getActivityStatsAll(cutoffTime);

            Map<String, Object> response = new HashMap<>();
            response.put("type", "activity_stats_all");
            response.put("stats", stats);
            response.put("period_days", days);
            response.put("timestamp", Instant.now().toString());

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Error getting activity stats: {}", e.getMessage(), e);
            return ResponseEntity.status(500).body(Map.of(
                    "error", "Failed to get activity stats",
                    "timestamp", Instant.now().toString()
            ));
        }
    }

    @GetMapping("/admin/user-list")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ResponseEntity<?> getUserList(
            @RequestParam(defaultValue = "24") Long hours) {

        try {
            String userRole = userService.getRoleForUser().getName();
            if (!isAdmin(userRole)) {
                return ResponseEntity.status(403).body(Map.of(
                        "error", "Access denied. Admin role required.",
                        "timestamp", Instant.now().toString()
                ));
            }

            Instant cutoffTime = Instant.now().minus(hours, ChronoUnit.HOURS);
            List<Map<String, Object>> activeUsers =
                    userCinemaActivityService.getActiveUsersWithStats(cutoffTime);

            Map<String, Object> response = new HashMap<>();
            response.put("type", "user_list");
            response.put("users", activeUsers);
            response.put("count", activeUsers.size());
            response.put("period_hours", hours);
            response.put("timestamp", Instant.now().toString());

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Error getting user list: {}", e.getMessage(), e);
            return ResponseEntity.status(500).body(Map.of(
                    "error", "Failed to get user list",
                    "timestamp", Instant.now().toString()
            ));
        }
    }

    @GetMapping("/admin/dashboard-stats")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ResponseEntity<?> getDashboardStats(
            @RequestParam(defaultValue = "7") Long days) {

        try {
            String userRole = userService.getRoleForUser().getName();
            if (!isAdmin(userRole)) {
                return ResponseEntity.status(403).body(Map.of(
                        "error", "Access denied. Admin role required.",
                        "timestamp", Instant.now().toString()
                ));
            }

            Instant cutoffTime = Instant.now().minus(days, ChronoUnit.DAYS);
            Map<String, Object> dashboardStats =
                    userCinemaActivityService.getDashboardStats(cutoffTime);

            Map<String, Object> response = new HashMap<>();
            response.put("type", "dashboard_stats");
            response.put("stats", dashboardStats);
            response.put("period_days", days);
            response.put("timestamp", Instant.now().toString());

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Error getting dashboard stats: {}", e.getMessage(), e);
            return ResponseEntity.status(500).body(Map.of(
                    "error", "Failed to get dashboard stats",
                    "timestamp", Instant.now().toString()
            ));
        }
    }

    // USER ENDPOINTS (Limited access)

    @GetMapping("/user/my-activities")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ResponseEntity<?> getMyActivities(
            @RequestParam(defaultValue = "50") Integer limit,
            @RequestParam(required = false) String activityType,
            @RequestParam(defaultValue = "24") Long hours) {

        try {
            String userEmail = userService.getUserFromToken().getEmail();
            Instant cutoffTime = Instant.now().minus(hours, ChronoUnit.HOURS);
            UserEntity currentUser = userService.getUserEntityByEmail(userEmail);

            if (currentUser == null) {
                return ResponseEntity.status(404).body(Map.of(
                        "error", "User not found",
                        "timestamp", Instant.now().toString()
                ));
            }

            List<UserCinemaActivityEntity> activities;

            if (activityType != null) {
                UserCinemaActivityEntity.ActivityType type =
                        UserCinemaActivityEntity.ActivityType.valueOf(activityType.toUpperCase());
                activities = userCinemaActivityService.getRecentActivitiesByType(currentUser, type, cutoffTime, limit);
            } else {
                activities = userCinemaActivityService.getRecentActivities(currentUser, cutoffTime, limit);
            }

            Map<String, Object> response = new HashMap<>();
            response.put("type", "my_activities");
            response.put("activities", activities.stream()
                    .map(this::convertActivityToDto)
                    .toList());
            response.put("count", activities.size());
            response.put("timestamp", Instant.now().toString());

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Error getting user activities for {}: {}", userService.getUserFromToken().getEmail(), e.getMessage(), e);
            return ResponseEntity.status(500).body(Map.of(
                    "error", "Failed to get user activities",
                    "timestamp", Instant.now().toString()
            ));
        }
    }

    // Initial data endpoint (combines user role and initial stats)
    @GetMapping("/initial-data")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ResponseEntity<?> getInitialData() {
        try {
            String userEmail = userService.getUserFromToken().getEmail();
            String userRole = userService.getRoleForUser().getName();

            Map<String, Object> response = new HashMap<>();
            response.put("type", "initial_data");
            response.put("userRole", userRole);
            response.put("timestamp", Instant.now().toString());

            if (isAdmin(userRole)) {
                Instant cutoffTime = Instant.now().minus(24, ChronoUnit.HOURS);
                Map<String, Object> adminData = new HashMap<>();
                adminData.put("totalActivities", userCinemaActivityService.getTotalActivitiesCount(cutoffTime));
                adminData.put("activeUsers", userCinemaActivityService.getActiveUsersCount(cutoffTime));
                response.put("adminData", adminData);
            }

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Error getting initial data: {}", e.getMessage(), e);
            return ResponseEntity.status(500).body(Map.of(
                    "error", "Failed to get initial data",
                    "timestamp", Instant.now().toString()
            ));
        }
    }

}
