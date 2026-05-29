package com.db.dbworld.app.media.download.ws;

import com.db.dbworld.app.media.ingestion.tracking.TrackingService;
import tools.jackson.databind.ObjectMapper;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.Map;
import java.util.Set;
import java.util.concurrent.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * WebSocket handler that broadcasts download/ingestion progress to all connected clients.
 *
 * Migrated from com.db.dbworld.handler.MirrorStatusHandler.
 * Decoupled from deprecated StatusService — uses TrackingService instead.
 *
 * Broadcasts every 2 seconds:
 *   - All active ingestion job snapshots from TrackingService
 *   - jobId, status, progress, speed, eta
 */
@Log4j2
@Service
public class MirrorStatusHandler extends TextWebSocketHandler {

    private final TrackingService trackingService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    private final Set<WebSocketSession> sessions = ConcurrentHashMap.newKeySet();
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "mirror-ws-broadcast");
        t.setDaemon(true);
        return t;
    });

    public MirrorStatusHandler(TrackingService trackingService) {
        this.trackingService = trackingService;
        scheduler.scheduleAtFixedRate(this::broadcastStatuses, 0, 2, TimeUnit.SECONDS);
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        sessions.add(session);
        log.debug("WS connected: {} (active sessions={})", session.getId(), sessions.size());
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        sessions.remove(session);
        log.debug("WS disconnected: {} status={} (active sessions={})",
                session.getId(), status, sessions.size());
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        // clients push no messages; server-push only
    }

    private void broadcastStatuses() {
        if (sessions.isEmpty()) return;
        try {
            // getAll() returns jobId → status/progress map for all tracked jobs
            Map<String, Object> all = trackingService.getAll();
            String json = objectMapper.writeValueAsString(all);

            for (WebSocketSession session : sessions) {
                if (session.isOpen()) {
                    session.sendMessage(new TextMessage(json));
                }
            }
        } catch (Exception e) {
            log.error("WS broadcast error", e);
        }
    }
}
