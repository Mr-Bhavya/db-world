//package com.db.dbworld.handler;
//
//import com.db.dbworld.audit.activity.entity.UserCinemaActivityEntity;
//import com.db.dbworld.core.user.entity.UserEntity;
//import com.db.dbworld.audit.activity.service.UserCinemaActivityService;
//import com.db.dbworld.core.user.service.UserService;
//import com.fasterxml.jackson.databind.ObjectMapper;
//import lombok.extern.log4j.Log4j2;
//import org.springframework.stereotype.Component;
//import org.springframework.web.socket.CloseStatus;
//import org.springframework.web.socket.TextMessage;
//import org.springframework.web.socket.WebSocketSession;
//import org.springframework.web.socket.handler.TextWebSocketHandler;
//
//import java.io.IOException;
//import java.time.Instant;
//import java.time.temporal.ChronoUnit;
//import java.util.*;
//import java.util.concurrent.ConcurrentHashMap;
//import java.util.concurrent.CopyOnWriteArrayList;
//
///**
// * @deprecated Migrated to {@link com.db.dbworld.app.cinema.activity.ws.UserCinemaActivityHandler}.
// */
//@Deprecated(forRemoval = true)
//@Log4j2
//@Component
//public class UserCinemaActivityHandler extends TextWebSocketHandler {
//
//    private final UserCinemaActivityService userCinemaActivityService;
//    private final UserService userService;
//    private final ObjectMapper objectMapper;
//
//    // Store active sessions by user email
//    private final Map<String, List<WebSocketSession>> userSessions = new ConcurrentHashMap<>();
//    // Store session to user mapping
//    private final Map<String, String> sessionToUserMap = new ConcurrentHashMap<>();
//    // Store user roles
//    private final Map<String, String> userRoles = new ConcurrentHashMap<>();
//
//    public UserCinemaActivityHandler(UserCinemaActivityService userCinemaActivityService,
//                                     UserService userService,
//                                     ObjectMapper objectMapper) {
//        this.userCinemaActivityService = userCinemaActivityService;
//        this.userService = userService;
//        this.objectMapper = objectMapper;
//    }
//
//    @Override
//    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
////        String userEmail = extractUserFromSession(session);
//        String userEmail = "sam8@gmail.com";
//        if (userEmail != null) {
//            String userRole = getUserRole(userEmail);
//            if (userRole != null) {
//                addSession(userEmail, session);
//                userRoles.put(userEmail, userRole);
//                log.info("WebSocket connection established for user: {}, role: {}, session: {}",
//                        userEmail, userRole, session.getId());
//
//                // Send initial data based on role
//                sendInitialData(userEmail, userRole, session);
//            } else {
//                log.warn("User role not found for: {}, closing session", userEmail);
//                session.close(CloseStatus.NOT_ACCEPTABLE);
//            }
//        } else {
//            log.warn("WebSocket connection established without user authentication, closing session: {}",
//                    session.getId());
//            session.close(CloseStatus.NOT_ACCEPTABLE);
//        }
//    }
//
//    @Override
//    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
//        removeSession(session);
//        log.info("WebSocket connection closed for session: {}, status: {}", session.getId(), status);
//    }
//
//    @Override
//    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
//        try {
//            String payload = message.getPayload();
//            log.debug("Received WebSocket message: {}", payload);
//
//            String userEmail = sessionToUserMap.get(session.getId());
//            if (userEmail == null) {
//                session.sendMessage(new TextMessage("{\"error\": \"User not authenticated\"}"));
//                return;
//            }
//
//            String userRole = userRoles.get(userEmail);
//            if (userRole == null) {
//                session.sendMessage(new TextMessage("{\"error\": \"User role not found\"}"));
//                return;
//            }
//
//            // Parse the message
//            Map<String, Object> request = objectMapper.readValue(payload, Map.class);
//            String action = (String) request.get("action");
//
//            // Route actions based on user role
//            if (isAdmin(userRole)) {
//                handleAdminActions(session, userEmail, request, action);
//            } else {
//                handleUserActions(session, userEmail, request, action);
//            }
//
//        } catch (Exception e) {
//            log.error("Error handling WebSocket message: {}", e.getMessage(), e);
//            try {
//                session.sendMessage(new TextMessage("{\"error\": \"Internal server error\"}"));
//            } catch (IOException ex) {
//                log.error("Error sending error message: {}", ex.getMessage());
//            }
//        }
//    }
//
//    private void handleAdminActions(WebSocketSession session, String adminEmail,
//                                    Map<String, Object> request, String action) {
//        switch (action != null ? action : "") {
//            case "get_all_recent_activities":
//                handleGetAllRecentActivities(session, adminEmail, request);
//                break;
//            case "get_user_activities":
//                handleGetUserActivities(session, adminEmail, request);
//                break;
//            case "get_activity_stats_all":
//                handleGetActivityStatsAll(session, adminEmail, request);
//                break;
//            case "get_user_list":
//                handleGetUserList(session, adminEmail, request);
//                break;
//            case "get_dashboard_stats":
//                handleGetDashboardStats(session, adminEmail, request);
//                break;
//            case "subscribe_live_all":
//                handleSubscribeLiveAll(session, adminEmail, request);
//                break;
//            default:
//                sendError(session, "Unknown admin action: " + action);
//        }
//    }
//
//    private void handleUserActions(WebSocketSession session, String userEmail,
//                                   Map<String, Object> request, String action) {
//        // Regular users can only subscribe to live updates (no data viewing)
//        switch (action != null ? action : "") {
//            case "subscribe_live":
//                handleSubscribeLive(session, userEmail, request);
//                break;
//            default:
//                sendError(session, "Action not permitted for regular users");
//        }
//    }
//
//    // ADMIN METHODS
//
//    private void handleGetAllRecentActivities(WebSocketSession session, String adminEmail,
//                                              Map<String, Object> request) {
//        try {
//            // Parse request parameters
//            Integer limit = (Integer) request.getOrDefault("limit", 100);
//            String activityType = (String) request.get("activityType");
//            Long hours = ((Number) request.getOrDefault("hours", 24)).longValue();
//
//            Instant cutoffTime = Instant.now().minus(hours, ChronoUnit.HOURS);
//            List<UserCinemaActivityEntity> activities;
//
//            if (activityType != null) {
//                UserCinemaActivityEntity.ActivityType type =
//                        UserCinemaActivityEntity.ActivityType.valueOf(activityType.toUpperCase());
//                activities = userCinemaActivityService.getAllRecentActivitiesByType(type, cutoffTime, limit);
//            } else {
//                activities = userCinemaActivityService.getAllRecentActivities(cutoffTime, limit);
//            }
//
//            Map<String, Object> response = new HashMap<>();
//            response.put("type", "all_recent_activities");
//            response.put("activities", convertActivitiesToDtoWithUser(activities));
//            response.put("count", activities.size());
//            response.put("timestamp", Instant.now().toString());
//
//            String jsonResponse = objectMapper.writeValueAsString(response);
//            session.sendMessage(new TextMessage(jsonResponse));
//
//        } catch (Exception e) {
//            log.error("Error handling get_all_recent_activities for admin {}: {}", adminEmail, e.getMessage(), e);
//            sendError(session, "Failed to get all recent activities");
//        }
//    }
//
//    private void handleGetUserActivities(WebSocketSession session, String adminEmail,
//                                         Map<String, Object> request) {
//        try {
//            String targetUserEmail = (String) request.get("userEmail");
//            if (targetUserEmail == null) {
//                sendError(session, "userEmail parameter is required");
//                return;
//            }
//
//            Integer limit = (Integer) request.getOrDefault("limit", 50);
//            String activityType = (String) request.get("activityType");
//            Long hours = ((Number) request.getOrDefault("hours", 24)).longValue();
//
//            Instant cutoffTime = Instant.now().minus(hours, ChronoUnit.HOURS);
//            UserEntity targetUser = userService.getUserEntityByEmail(targetUserEmail);
//
//            if (targetUser == null) {
//                sendError(session, "User not found: " + targetUserEmail);
//                return;
//            }
//
//            List<UserCinemaActivityEntity> activities;
//
//            if (activityType != null) {
//                UserCinemaActivityEntity.ActivityType type =
//                        UserCinemaActivityEntity.ActivityType.valueOf(activityType.toUpperCase());
//                activities = userCinemaActivityService.getRecentActivitiesByType(targetUser, type, cutoffTime, limit);
//            } else {
//                activities = userCinemaActivityService.getRecentActivities(targetUser, cutoffTime, limit);
//            }
//
//            Map<String, Object> response = new HashMap<>();
//            response.put("type", "user_activities");
//            response.put("userEmail", targetUserEmail);
//            response.put("activities", convertActivitiesToDto(activities));
//            response.put("count", activities.size());
//            response.put("timestamp", Instant.now().toString());
//
//            String jsonResponse = objectMapper.writeValueAsString(response);
//            session.sendMessage(new TextMessage(jsonResponse));
//
//        } catch (Exception e) {
//            log.error("Error handling get_user_activities for admin {}: {}", adminEmail, e.getMessage(), e);
//            sendError(session, "Failed to get user activities");
//        }
//    }
//
//    private void handleGetActivityStatsAll(WebSocketSession session, String adminEmail,
//                                           Map<String, Object> request) {
//        try {
//            Long days = ((Number) request.getOrDefault("days", 7)).longValue();
//            Instant cutoffTime = Instant.now().minus(days, ChronoUnit.DAYS);
//
//            Map<UserCinemaActivityEntity.ActivityType, Long> stats =
//                    userCinemaActivityService.getActivityStatsAll(cutoffTime);
//
//            Map<String, Object> response = new HashMap<>();
//            response.put("type", "activity_stats_all");
//            response.put("stats", stats);
//            response.put("period_days", days);
//            response.put("timestamp", Instant.now().toString());
//
//            String jsonResponse = objectMapper.writeValueAsString(response);
//            session.sendMessage(new TextMessage(jsonResponse));
//
//        } catch (Exception e) {
//            log.error("Error handling get_activity_stats_all for admin {}: {}", adminEmail, e.getMessage(), e);
//            sendError(session, "Failed to get activity stats for all users");
//        }
//    }
//
//    private void handleGetUserList(WebSocketSession session, String adminEmail,
//                                   Map<String, Object> request) {
//        try {
//            Long hours = ((Number) request.getOrDefault("hours", 24)).longValue();
//            Instant cutoffTime = Instant.now().minus(hours, ChronoUnit.HOURS);
//
//            List<Map<String, Object>> activeUsers =
//                    userCinemaActivityService.getActiveUsersWithStats(cutoffTime);
//
//            Map<String, Object> response = new HashMap<>();
//            response.put("type", "user_list");
//            response.put("users", activeUsers);
//            response.put("count", activeUsers.size());
//            response.put("period_hours", hours);
//            response.put("timestamp", Instant.now().toString());
//
//            String jsonResponse = objectMapper.writeValueAsString(response);
//            session.sendMessage(new TextMessage(jsonResponse));
//
//        } catch (Exception e) {
//            log.error("Error handling get_user_list for admin {}: {}", adminEmail, e.getMessage(), e);
//            sendError(session, "Failed to get user list");
//        }
//    }
//
//    private void handleGetDashboardStats(WebSocketSession session, String adminEmail,
//                                         Map<String, Object> request) {
//        try {
//            Long days = ((Number) request.getOrDefault("days", 7)).longValue();
//            Instant cutoffTime = Instant.now().minus(days, ChronoUnit.DAYS);
//
//            Map<String, Object> dashboardStats =
//                    userCinemaActivityService.getDashboardStats(cutoffTime);
//
//            Map<String, Object> response = new HashMap<>();
//            response.put("type", "dashboard_stats");
//            response.put("stats", dashboardStats);
//            response.put("period_days", days);
//            response.put("timestamp", Instant.now().toString());
//
//            String jsonResponse = objectMapper.writeValueAsString(response);
//            session.sendMessage(new TextMessage(jsonResponse));
//
//        } catch (Exception e) {
//            log.error("Error handling get_dashboard_stats for admin {}: {}", adminEmail, e.getMessage(), e);
//            sendError(session, "Failed to get dashboard stats");
//        }
//    }
//
//    private void handleSubscribeLiveAll(WebSocketSession session, String adminEmail,
//                                        Map<String, Object> request) {
//        try {
//            Map<String, Object> response = new HashMap<>();
//            response.put("type", "subscribe_ack_all");
//            response.put("message", "Subscribed to live activity updates for all users");
//            response.put("timestamp", Instant.now().toString());
//
//            String jsonResponse = objectMapper.writeValueAsString(response);
//            session.sendMessage(new TextMessage(jsonResponse));
//
//        } catch (Exception e) {
//            log.error("Error handling subscribe_live_all for admin {}: {}", adminEmail, e.getMessage(), e);
//            sendError(session, "Failed to subscribe to live updates for all users");
//        }
//    }
//
//    // USER METHODS (Limited)
//
//    private void handleSubscribeLive(WebSocketSession session, String userEmail, Map<String, Object> request) {
//        try {
//            Map<String, Object> response = new HashMap<>();
//            response.put("type", "subscribe_ack");
//            response.put("message", "Subscribed to live activity updates");
//            response.put("timestamp", Instant.now().toString());
//
//            String jsonResponse = objectMapper.writeValueAsString(response);
//            session.sendMessage(new TextMessage(jsonResponse));
//
//        } catch (Exception e) {
//            log.error("Error handling subscribe_live for user {}: {}", userEmail, e.getMessage(), e);
//            sendError(session, "Failed to subscribe to live updates");
//        }
//    }
//
//    // HELPER METHODS
//
//    private void addSession(String userEmail, WebSocketSession session) {
//        userSessions.computeIfAbsent(userEmail, k -> new CopyOnWriteArrayList<>()).add(session);
//        sessionToUserMap.put(session.getId(), userEmail);
//    }
//
//    private void removeSession(WebSocketSession session) {
//        String userEmail = sessionToUserMap.remove(session.getId());
//        if (userEmail != null) {
//            userRoles.remove(userEmail);
//            List<WebSocketSession> sessions = userSessions.get(userEmail);
//            if (sessions != null) {
//                sessions.remove(session);
//                if (sessions.isEmpty()) {
//                    userSessions.remove(userEmail);
//                }
//            }
//        }
//    }
//
//    private String extractUserFromSession(WebSocketSession session) {
//        try {
//            String query = session.getUri().getQuery();
//            if (query != null) {
//                Map<String, String> queryParams = parseQueryString(query);
//                String token = queryParams.get("token");
//                if (token != null) {
//                    return userService.getUserFromToken(token);
//                }
//            }
//            return null;
//        } catch (Exception e) {
//            log.error("Error extracting user from WebSocket session: {}", e.getMessage(), e);
//            return null;
//        }
//    }
//
//    private String getUserRole(String userEmail) {
//        try {
//            UserEntity user = userService.getUserEntityByEmail(userEmail);
//            return user != null ? user.getRole().getName() : null;
//        } catch (Exception e) {
//            log.error("Error getting user role for {}: {}", userEmail, e.getMessage(), e);
//            return null;
//        }
//    }
//
//    private boolean isAdmin(String role) {
//        return "ADMIN".equals(role) || "OWNER".equals(role);
//    }
//
//    private void sendInitialData(String userEmail, String userRole, WebSocketSession session) {
//        try {
//            Map<String, Object> response = new HashMap<>();
//            response.put("type", "initial_data");
//            response.put("userRole", userRole);
//            response.put("timestamp", Instant.now().toString());
//
//            if (isAdmin(userRole)) {
//                // Send admin-specific initial data
//                Instant cutoffTime = Instant.now().minus(24, ChronoUnit.HOURS);
//                Map<String, Object> adminData = new HashMap<>();
//                adminData.put("totalActivities", userCinemaActivityService.getTotalActivitiesCount(cutoffTime));
//                adminData.put("activeUsers", userCinemaActivityService.getActiveUsersCount(cutoffTime));
//                response.put("adminData", adminData);
//            }
//
//            String jsonResponse = objectMapper.writeValueAsString(response);
//            session.sendMessage(new TextMessage(jsonResponse));
//
//        } catch (Exception e) {
//            log.error("Error sending initial data to user {}: {}", userEmail, e.getMessage(), e);
//        }
//    }
//
//    private Map<String, String> parseQueryString(String query) {
//        Map<String, String> result = new HashMap<>();
//        if (query != null) {
//            String[] pairs = query.split("&");
//            for (String pair : pairs) {
//                String[] keyValue = pair.split("=");
//                if (keyValue.length == 2) {
//                    result.put(keyValue[0], keyValue[1]);
//                }
//            }
//        }
//        return result;
//    }
//
//    private List<Map<String, Object>> convertActivitiesToDto(List<UserCinemaActivityEntity> activities) {
//        List<Map<String, Object>> result = new ArrayList<>();
//        for (UserCinemaActivityEntity activity : activities) {
//            result.add(convertActivityToDto(activity));
//        }
//        return result;
//    }
//
//    private List<Map<String, Object>> convertActivitiesToDtoWithUser(List<UserCinemaActivityEntity> activities) {
//        List<Map<String, Object>> result = new ArrayList<>();
//        for (UserCinemaActivityEntity activity : activities) {
//            Map<String, Object> dto = convertActivityToDto(activity);
//            dto.put("userEmail", activity.getUser().getEmail());
//            result.add(dto);
//        }
//        return result;
//    }
//
//    private Map<String, Object> convertActivityToDto(UserCinemaActivityEntity activity) {
//        Map<String, Object> dto = new HashMap<>();
//        dto.put("id", activity.getId());
//        dto.put("activityType", activity.getActivityType().name());
//        dto.put("activityValue", activity.getActivityValue());
//        dto.put("filePath", activity.getFilePath());
//        dto.put("fileSize", activity.getFileSize());
//        dto.put("bytesTransferred", activity.getBytesTransferred());
//        dto.put("remoteAddr", activity.getRemoteAddr());
//        dto.put("userAgent", activity.getUserAgent());
//        dto.put("createdTime", activity.getCreatedTime().toString());
//        dto.put("lastUpdated", activity.getLastUpdated().toString());
//        return dto;
//    }
//
//    private void sendError(WebSocketSession session, String errorMessage) {
//        try {
//            Map<String, Object> errorResponse = new HashMap<>();
//            errorResponse.put("error", errorMessage);
//            errorResponse.put("timestamp", Instant.now().toString());
//            String jsonResponse = objectMapper.writeValueAsString(errorResponse);
//            session.sendMessage(new TextMessage(jsonResponse));
//        } catch (IOException e) {
//            log.error("Error sending error message: {}", e.getMessage());
//        }
//    }
//
//    // Broadcast to all admin sessions
//    public void broadcastToAdmins(Map<String, Object> data) {
//        for (Map.Entry<String, String> entry : userRoles.entrySet()) {
//            if (isAdmin(entry.getValue())) {
//                List<WebSocketSession> sessions = userSessions.get(entry.getKey());
//                if (sessions != null) {
//                    for (WebSocketSession session : sessions) {
//                        if (session.isOpen()) {
//                            try {
//                                String jsonData = objectMapper.writeValueAsString(data);
//                                session.sendMessage(new TextMessage(jsonData));
//                            } catch (Exception e) {
//                                log.error("Error broadcasting to admin {}: {}", entry.getKey(), e.getMessage(), e);
//                            }
//                        }
//                    }
//                }
//            }
//        }
//    }
//}