package com.db.dbworld.app.cinema.activity.ws;

import com.db.dbworld.audit.activity.entity.UserCinemaActivityEntity;
import com.db.dbworld.core.user.entity.UserEntity;
import com.db.dbworld.audit.activity.service.UserCinemaActivityService;
import com.db.dbworld.core.user.service.UserService;
import com.db.dbworld.security.auth.JwtService;
import tools.jackson.databind.ObjectMapper;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * WebSocket handler for real-time cinema activity monitoring.
 * Migrated from com.db.dbworld.handler.UserCinemaActivityHandler.
 *
 * Admin roles (ADMIN/OWNER): full access to all user activities, stats, dashboard.
 * Regular users: subscribe-only (live update acknowledgements).
 */
@Log4j2
@Component
public class UserCinemaActivityHandler extends TextWebSocketHandler {

    private final UserCinemaActivityService userCinemaActivityService;
    private final UserService userService;
    private final ObjectMapper objectMapper;
    private final JwtService jwtService;

    // per-user session list
    private final Map<String, List<WebSocketSession>> userSessions = new ConcurrentHashMap<>();
    // sessionId → userEmail
    private final Map<String, String> sessionToUserMap = new ConcurrentHashMap<>();
    // userEmail → role name
    private final Map<String, String> userRoles = new ConcurrentHashMap<>();

    public UserCinemaActivityHandler(UserCinemaActivityService userCinemaActivityService,
                                     UserService userService,
                                     ObjectMapper objectMapper,
                                     JwtService jwtService) {
        this.userCinemaActivityService = userCinemaActivityService;
        this.userService = userService;
        this.objectMapper = objectMapper;
        this.jwtService = jwtService;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Lifecycle
    // ──────────────────────────────────────────────────────────────────────────

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        String userEmail = extractUserFromSession(session);
        if (userEmail != null) {
            String userRole = getUserRole(userEmail);
            if (userRole != null) {
                addSession(userEmail, session);
                userRoles.put(userEmail, userRole);
                log.info("WS connected — user={}, role={}, session={}", userEmail, userRole, session.getId());
                sendInitialData(userEmail, userRole, session);
            } else {
                log.warn("Role not found for user={}, closing session", userEmail);
                session.close(CloseStatus.NOT_ACCEPTABLE);
            }
        } else {
            log.warn("Unauthenticated WS connection, closing session={}", session.getId());
            session.close(CloseStatus.NOT_ACCEPTABLE);
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        removeSession(session);
        log.info("WS disconnected — session={}, status={}", session.getId(), status);
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        try {
            String payload = message.getPayload();
            log.debug("WS message received: {}", payload);

            String userEmail = sessionToUserMap.get(session.getId());
            if (userEmail == null) {
                session.sendMessage(new TextMessage("{\"error\": \"User not authenticated\"}"));
                return;
            }

            String userRole = userRoles.get(userEmail);
            if (userRole == null) {
                session.sendMessage(new TextMessage("{\"error\": \"User role not found\"}"));
                return;
            }

            Map<String, Object> request = objectMapper.readValue(payload, Map.class);
            String action = (String) request.get("action");

            if (isAdmin(userRole)) {
                handleAdminActions(session, userEmail, request, action);
            } else {
                handleUserActions(session, userEmail, request, action);
            }

        } catch (Exception e) {
            log.error("Error handling WS message: {}", e.getMessage(), e);
            try {
                session.sendMessage(new TextMessage("{\"error\": \"Internal server error\"}"));
            } catch (IOException ex) {
                log.error("Error sending error message: {}", ex.getMessage());
            }
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Admin action routing
    // ──────────────────────────────────────────────────────────────────────────

    private void handleAdminActions(WebSocketSession session, String adminEmail,
                                    Map<String, Object> request, String action) {
        switch (action != null ? action : "") {
            case "get_all_recent_activities" -> handleGetAllRecentActivities(session, adminEmail, request);
            case "get_user_activities"       -> handleGetUserActivities(session, adminEmail, request);
            case "get_activity_stats_all"    -> handleGetActivityStatsAll(session, adminEmail, request);
            case "get_user_list"             -> handleGetUserList(session, adminEmail, request);
            case "get_dashboard_stats"       -> handleGetDashboardStats(session, adminEmail, request);
            case "subscribe_live_all"        -> handleSubscribeLiveAll(session, adminEmail, request);
            default                          -> sendError(session, "Unknown admin action: " + action);
        }
    }

    private void handleUserActions(WebSocketSession session, String userEmail,
                                   Map<String, Object> request, String action) {
        switch (action != null ? action : "") {
            case "subscribe_live" -> handleSubscribeLive(session, userEmail, request);
            default               -> sendError(session, "Action not permitted for regular users");
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Admin handlers
    // ──────────────────────────────────────────────────────────────────────────

    private void handleGetAllRecentActivities(WebSocketSession session, String adminEmail,
                                              Map<String, Object> request) {
        try {
            Integer limit = (Integer) request.getOrDefault("limit", 100);
            String activityType = (String) request.get("activityType");
            Long hours = ((Number) request.getOrDefault("hours", 24)).longValue();
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
            response.put("activities", convertActivitiesToDtoWithUser(activities));
            response.put("count", activities.size());
            response.put("timestamp", Instant.now().toString());
            session.sendMessage(new TextMessage(objectMapper.writeValueAsString(response)));

        } catch (Exception e) {
            log.error("get_all_recent_activities error for admin={}: {}", adminEmail, e.getMessage(), e);
            sendError(session, "Failed to get all recent activities");
        }
    }

    private void handleGetUserActivities(WebSocketSession session, String adminEmail,
                                         Map<String, Object> request) {
        try {
            String targetUserEmail = (String) request.get("userEmail");
            if (targetUserEmail == null) { sendError(session, "userEmail parameter is required"); return; }

            Integer limit = (Integer) request.getOrDefault("limit", 50);
            String activityType = (String) request.get("activityType");
            Long hours = ((Number) request.getOrDefault("hours", 24)).longValue();
            Instant cutoffTime = Instant.now().minus(hours, ChronoUnit.HOURS);

            UserEntity targetUser = userService.getUserEntityByEmail(targetUserEmail);
            if (targetUser == null) { sendError(session, "User not found: " + targetUserEmail); return; }

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
            response.put("userEmail", targetUserEmail);
            response.put("activities", convertActivitiesToDto(activities));
            response.put("count", activities.size());
            response.put("timestamp", Instant.now().toString());
            session.sendMessage(new TextMessage(objectMapper.writeValueAsString(response)));

        } catch (Exception e) {
            log.error("get_user_activities error for admin={}: {}", adminEmail, e.getMessage(), e);
            sendError(session, "Failed to get user activities");
        }
    }

    private void handleGetActivityStatsAll(WebSocketSession session, String adminEmail,
                                           Map<String, Object> request) {
        try {
            Long days = ((Number) request.getOrDefault("days", 7)).longValue();
            Instant cutoffTime = Instant.now().minus(days, ChronoUnit.DAYS);
            Map<UserCinemaActivityEntity.ActivityType, Long> stats =
                    userCinemaActivityService.getActivityStatsAll(cutoffTime);

            Map<String, Object> response = new HashMap<>();
            response.put("type", "activity_stats_all");
            response.put("stats", stats);
            response.put("period_days", days);
            response.put("timestamp", Instant.now().toString());
            session.sendMessage(new TextMessage(objectMapper.writeValueAsString(response)));

        } catch (Exception e) {
            log.error("get_activity_stats_all error for admin={}: {}", adminEmail, e.getMessage(), e);
            sendError(session, "Failed to get activity stats");
        }
    }

    private void handleGetUserList(WebSocketSession session, String adminEmail,
                                   Map<String, Object> request) {
        try {
            Long hours = ((Number) request.getOrDefault("hours", 24)).longValue();
            Instant cutoffTime = Instant.now().minus(hours, ChronoUnit.HOURS);
            List<Map<String, Object>> activeUsers = userCinemaActivityService.getActiveUsersWithStats(cutoffTime);

            Map<String, Object> response = new HashMap<>();
            response.put("type", "user_list");
            response.put("users", activeUsers);
            response.put("count", activeUsers.size());
            response.put("period_hours", hours);
            response.put("timestamp", Instant.now().toString());
            session.sendMessage(new TextMessage(objectMapper.writeValueAsString(response)));

        } catch (Exception e) {
            log.error("get_user_list error for admin={}: {}", adminEmail, e.getMessage(), e);
            sendError(session, "Failed to get user list");
        }
    }

    private void handleGetDashboardStats(WebSocketSession session, String adminEmail,
                                         Map<String, Object> request) {
        try {
            Long days = ((Number) request.getOrDefault("days", 7)).longValue();
            Instant cutoffTime = Instant.now().minus(days, ChronoUnit.DAYS);
            Map<String, Object> dashboardStats = userCinemaActivityService.getDashboardStats(cutoffTime);

            Map<String, Object> response = new HashMap<>();
            response.put("type", "dashboard_stats");
            response.put("stats", dashboardStats);
            response.put("period_days", days);
            response.put("timestamp", Instant.now().toString());
            session.sendMessage(new TextMessage(objectMapper.writeValueAsString(response)));

        } catch (Exception e) {
            log.error("get_dashboard_stats error for admin={}: {}", adminEmail, e.getMessage(), e);
            sendError(session, "Failed to get dashboard stats");
        }
    }

    private void handleSubscribeLiveAll(WebSocketSession session, String adminEmail,
                                        Map<String, Object> request) {
        try {
            Map<String, Object> response = new HashMap<>();
            response.put("type", "subscribe_ack_all");
            response.put("message", "Subscribed to live activity updates for all users");
            response.put("timestamp", Instant.now().toString());
            session.sendMessage(new TextMessage(objectMapper.writeValueAsString(response)));
        } catch (Exception e) {
            log.error("subscribe_live_all error for admin={}: {}", adminEmail, e.getMessage(), e);
            sendError(session, "Failed to subscribe to live updates for all users");
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // User handlers
    // ──────────────────────────────────────────────────────────────────────────

    private void handleSubscribeLive(WebSocketSession session, String userEmail, Map<String, Object> request) {
        try {
            Map<String, Object> response = new HashMap<>();
            response.put("type", "subscribe_ack");
            response.put("message", "Subscribed to live activity updates");
            response.put("timestamp", Instant.now().toString());
            session.sendMessage(new TextMessage(objectMapper.writeValueAsString(response)));
        } catch (Exception e) {
            log.error("subscribe_live error for user={}: {}", userEmail, e.getMessage(), e);
            sendError(session, "Failed to subscribe to live updates");
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Session management
    // ──────────────────────────────────────────────────────────────────────────

    private void addSession(String userEmail, WebSocketSession session) {
        userSessions.computeIfAbsent(userEmail, k -> new CopyOnWriteArrayList<>()).add(session);
        sessionToUserMap.put(session.getId(), userEmail);
    }

    private void removeSession(WebSocketSession session) {
        String userEmail = sessionToUserMap.remove(session.getId());
        if (userEmail != null) {
            userRoles.remove(userEmail);
            List<WebSocketSession> sessions = userSessions.get(userEmail);
            if (sessions != null) {
                sessions.remove(session);
                if (sessions.isEmpty()) userSessions.remove(userEmail);
            }
        }
    }

    /** Broadcast a payload to all connected admin sessions. */
    public void broadcastToAdmins(Map<String, Object> data) {
        for (Map.Entry<String, String> entry : userRoles.entrySet()) {
            if (isAdmin(entry.getValue())) {
                List<WebSocketSession> sessions = userSessions.get(entry.getKey());
                if (sessions != null) {
                    for (WebSocketSession session : sessions) {
                        if (session.isOpen()) {
                            try {
                                session.sendMessage(new TextMessage(objectMapper.writeValueAsString(data)));
                            } catch (Exception e) {
                                log.error("Broadcast error to admin={}: {}", entry.getKey(), e.getMessage(), e);
                            }
                        }
                    }
                }
            }
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────────────────────────────

    private String extractUserFromSession(WebSocketSession session) {
        try {
            String query = session.getUri().getQuery();
            if (query != null) {
                for (String pair : query.split("&")) {
                    String[] kv = pair.split("=");
                    if (kv.length == 2 && "token".equals(kv[0])) {
                        return jwtService.parse(kv[1]).email();
                    }
                }
            }
        } catch (Exception e) {
            log.error("Error extracting user from session: {}", e.getMessage(), e);
        }
        return null;
    }

    private String getUserRole(String userEmail) {
        try {
            UserEntity user = userService.getUserEntityByEmail(userEmail);
            return user != null ? user.getRole().getName().name() : null;
        } catch (Exception e) {
            log.error("Error getting role for user={}: {}", userEmail, e.getMessage(), e);
            return null;
        }
    }

    private boolean isAdmin(String role) {
        return "ADMIN".equals(role) || "OWNER".equals(role);
    }

    private void sendInitialData(String userEmail, String userRole, WebSocketSession session) {
        try {
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

            session.sendMessage(new TextMessage(objectMapper.writeValueAsString(response)));
        } catch (Exception e) {
            log.error("Error sending initial data to user={}: {}", userEmail, e.getMessage(), e);
        }
    }

    private void sendError(WebSocketSession session, String errorMessage) {
        try {
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("error", errorMessage);
            errorResponse.put("timestamp", Instant.now().toString());
            session.sendMessage(new TextMessage(objectMapper.writeValueAsString(errorResponse)));
        } catch (IOException e) {
            log.error("Error sending error message: {}", e.getMessage());
        }
    }

    private List<Map<String, Object>> convertActivitiesToDto(List<UserCinemaActivityEntity> activities) {
        return activities.stream().map(this::convertActivityToDto).toList();
    }

    private List<Map<String, Object>> convertActivitiesToDtoWithUser(List<UserCinemaActivityEntity> activities) {
        return activities.stream().map(a -> {
            Map<String, Object> dto = convertActivityToDto(a);
            dto.put("userEmail", a.getUser().getEmail());
            return dto;
        }).toList();
    }

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
}
