package com.db.dbworld.handler;

import com.db.dbworld.dao.user.UserCinemaDataRepository;
import com.db.dbworld.entities.user.UserCinemaDataEntity;
import com.db.dbworld.events.DownloadStatusUpdateEvent;
import com.db.dbworld.payloads.ApiResponse;
import com.db.dbworld.payloads.user.UserCinemaDataDto;
import com.db.dbworld.services.DownloadStatus;
import com.db.dbworld.services.NginxDownloadLogTrackerService;
import com.google.gson.Gson;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.event.EventListener;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;
import java.util.stream.Collectors;

@Log4j2
@Service
public class DownloadTrackerHandler extends TextWebSocketHandler {

    private static final int MAX_USER_HISTORY = 10;
    private static final int RECENT_ACTIVITY_HOURS = 24;
    private static final int BROADCAST_INTERVAL_MS = 3000;
    private static final int SESSION_TIMEOUT_MINUTES = 5;

    private final NginxDownloadLogTrackerService logTrackerService;
    private final UserCinemaDataRepository cinemaRepo;
    private final Set<WebSocketSession> sessions = new CopyOnWriteArraySet<>();
    private final Gson gson = new Gson();
    private final Map<String, SessionMetadata> sessionMetadata = new ConcurrentHashMap<>();

    @Autowired
    public DownloadTrackerHandler(NginxDownloadLogTrackerService logTrackerService,
                                  UserCinemaDataRepository cinemaRepo) {
        this.logTrackerService = logTrackerService;
        this.cinemaRepo = cinemaRepo;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        sessions.add(session);
        sessionMetadata.put(session.getId(), new SessionMetadata());
        log.debug("New WebSocket connection: {}", session.getId());
        sendInitialData(session);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session,
                                      org.springframework.web.socket.CloseStatus status) {
        sessions.remove(session);
        sessionMetadata.remove(session.getId());
        log.debug("WebSocket disconnected: {}", session.getId());
    }

    @EventListener
    public void onDownloadStatusUpdate(DownloadStatusUpdateEvent event) {
        broadcastStatusUpdate();
    }

    @Scheduled(fixedRate = BROADCAST_INTERVAL_MS)
    public void scheduledBroadcast() {
        cleanupStaleSessions();
        broadcastStatusUpdate();
    }

    private void cleanupStaleSessions() {
        Instant cutoff = Instant.now().minus(Duration.ofMinutes(SESSION_TIMEOUT_MINUTES));
        sessions.removeIf(session -> {
            SessionMetadata meta = sessionMetadata.get(session.getId());
            return meta != null && meta.getLastActivity().isBefore(cutoff);
        });
    }

    private void broadcastStatusUpdate() {
        if (sessions.isEmpty()) return;

        String payload = buildSerializedPayload();
        sessions.parallelStream()
                .filter(this::shouldSendUpdate)
                .forEach(session -> sendMessage(session, payload));
    }

    private boolean shouldSendUpdate(WebSocketSession session) {
        SessionMetadata meta = sessionMetadata.get(session.getId());
        if (meta == null) return false;

        Duration sinceLastUpdate = Duration.between(meta.getLastUpdate(), Instant.now());
        return sinceLastUpdate.toMillis() >= BROADCAST_INTERVAL_MS;
    }

    private void sendInitialData(WebSocketSession session) {
        sendMessage(session, buildSerializedPayload());
    }

    private String buildSerializedPayload() {
        return gson.toJson(buildApiResponse());
    }

    private ApiResponse<DashboardData> buildApiResponse() {
        Map<String, DownloadStatus> liveCache = logTrackerService.getCache();
        List<DownloadStatus> activeDownloads = getActiveDownloads(liveCache);
        ActivityStatistics stats = calculateActivityStatistics(activeDownloads);

        return new ApiResponse<>(
                HttpStatus.OK,
                true,
                "Download and Stream Analytics",
                new DashboardData(
                        activeDownloads,
                        stats,
                        fetchRecentUserActivities(),
                        calculateUserEngagement(),
                        getDownloadTrends()
                )
        );
    }

    private List<DownloadStatus> getActiveDownloads(Map<String, DownloadStatus> cache) {
        return cache.values().stream()
                .filter(status -> status.isStarted() && !status.isCompleted())
                .collect(Collectors.toList());
    }

    private ActivityStatistics calculateActivityStatistics(List<DownloadStatus> downloads) {
        Map<DownloadStatus.DownloadType, Long> countByType = downloads.stream()
                .collect(Collectors.groupingBy(
                        DownloadStatus::getType,
                        Collectors.counting()
                ));

        long uniqueUsers = downloads.stream()
                .map(DownloadStatus::getUserId)
                .distinct()
                .count();

        return new ActivityStatistics(
                countByType.getOrDefault(DownloadStatus.DownloadType.DOWNLOAD, 0L),
                countByType.getOrDefault(DownloadStatus.DownloadType.STREAM, 0L),
                uniqueUsers,
                calculateCompletionRate(downloads)
        );
    }

    private double calculateCompletionRate(List<DownloadStatus> downloads) {
        if (downloads.isEmpty()) return 0.0;

        long completedCount = downloads.stream()
                .filter(DownloadStatus::isCompleted)
                .count();

        return (double) completedCount / downloads.size() * 100;
    }

    @Transactional(readOnly = true)
    private List<UserCinemaDataDto> fetchRecentUserActivities() {
//        LocalDateTime cutoff = LocalDateTime.now().minusHours(RECENT_ACTIVITY_HOURS);
        Date cutoff = Date.from(Instant.now().minus(Duration.ofHours(RECENT_ACTIVITY_HOURS)));
        return cinemaRepo.findRecentActivities(cutoff, MAX_USER_HISTORY).stream()
                .map(this::convertToDto)
                .collect(Collectors.toList());
    }

    private UserCinemaDataDto convertToDto(UserCinemaDataEntity entity) {
        return new UserCinemaDataDto(
                entity.getId(),
                entity.getUser().getEmail(),
                entity.getEvent(),
                entity.getValue(),
                entity.getTime()
        );
    }

    private UserEngagement calculateUserEngagement() {
        Date lastHour = Date.from(Instant.now().minus(Duration.ofHours(1)));
        Date lastDay = Date.from(Instant.now().minus(Duration.ofHours(24)));

        return new UserEngagement(
                cinemaRepo.countActivitiesSince(lastHour),
                cinemaRepo.countActivitiesSince(lastDay),
                cinemaRepo.countUniqueUsersSince(lastHour),
                cinemaRepo.countUniqueUsersSince(lastDay)
        );
    }

    private DownloadTrends getDownloadTrends() {
        Date lastHour = Date.from(Instant.now().minus(Duration.ofHours(1)));
        Date lastDay = Date.from(Instant.now().minus(Duration.ofHours(24)));

        return new DownloadTrends(
                cinemaRepo.countByTypeAndTimeAfter("DOWNLOAD", lastHour),
                cinemaRepo.countByTypeAndTimeAfter("STREAM", lastHour),
                cinemaRepo.countByTypeAndTimeAfter("DOWNLOAD", lastDay),
                cinemaRepo.countByTypeAndTimeAfter("STREAM", lastDay)
        );
    }

    private void sendMessage(WebSocketSession session, String message) {
        try {
            if (session.isOpen()) {
                synchronized (session) {
                    session.sendMessage(new TextMessage(message));
                    updateSessionMetadata(session.getId());
                }
            }
        } catch (IOException e) {
            log.error("Failed to send message to session {}: {}", session.getId(), e.getMessage());
        }
    }

    private void updateSessionMetadata(String sessionId) {
        SessionMetadata meta = sessionMetadata.get(sessionId);
        if (meta != null) {
            meta.updateLastActivity();
            meta.updateLastUpdate();
        }
    }

    // Data classes
    @Data
    @AllArgsConstructor
    private static class DashboardData {
        private List<DownloadStatus> activeDownloads;
        private ActivityStatistics statistics;
        private List<UserCinemaDataDto> recentActivities;
        private UserEngagement userEngagement;
        private DownloadTrends trends;
    }

    @Data
    @AllArgsConstructor
    public static class ActivityStatistics {
        private long downloadCount;
        private long streamCount;
        private long activeUsers;
        private double completionRate; // percentage
    }

    @Data
    @AllArgsConstructor
    public static class UserEngagement {
        private long hourlyActivity;
        private long dailyActivity;
        private long hourlyActiveUsers;
        private long dailyActiveUsers;
    }

    @Data
    @AllArgsConstructor
    public static class DownloadTrends {
        private long hourlyDownloads;
        private long hourlyStreams;
        private long dailyDownloads;
        private long dailyStreams;
    }

    @Data
    private static class SessionMetadata {
        private Instant lastActivity;
        private Instant lastUpdate;

        public SessionMetadata() {
            this.lastActivity = Instant.now();
            this.lastUpdate = Instant.now();
        }

        public void updateLastActivity() {
            this.lastActivity = Instant.now();
        }

        public void updateLastUpdate() {
            this.lastUpdate = Instant.now();
        }
    }
}