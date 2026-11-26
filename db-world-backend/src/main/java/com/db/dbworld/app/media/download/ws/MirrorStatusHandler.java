package com.db.dbworld.app.media.download.ws;

import com.db.dbworld.app.media.ingestion.tracking.TrackingService;
import jakarta.annotation.PreDestroy;
import tools.jackson.databind.ObjectMapper;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.Map;
import java.util.concurrent.*;

/**
 * Pushes live ingestion job snapshots ({@link TrackingService#getAll()}) to connected admin clients.
 *
 * <ul>
 *   <li>Ticks every 2s but only sends when the payload changed, plus a keep-alive resend every
 *       {@link #KEEPALIVE_MS} so idle connections are not reaped by the container.</li>
 *   <li>A new session gets the current snapshot immediately instead of waiting for the next change.</li>
 *   <li>Each session is wrapped in a {@link ConcurrentWebSocketSessionDecorator}; a failing or slow
 *       session is closed and dropped without affecting the others.</li>
 * </ul>
 * Authentication is enforced at handshake by {@link AdminWsHandshakeInterceptor}.
 */
@Log4j2
@Service
public class MirrorStatusHandler extends TextWebSocketHandler {

    static final long KEEPALIVE_MS = 30_000;
    private static final int SEND_TIME_LIMIT_MS = 10_000;
    private static final int BUFFER_SIZE_LIMIT = 2 * 1024 * 1024;

    private final TrackingService trackingService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "mirror-ws-broadcast");
        t.setDaemon(true);
        return t;
    });

    private volatile String lastPayload;
    private volatile long lastSentAt;

    @Autowired
    public MirrorStatusHandler(TrackingService trackingService) {
        this(trackingService, true);
    }

    MirrorStatusHandler(TrackingService trackingService, boolean schedule) {
        this.trackingService = trackingService;
        if (schedule) scheduler.scheduleAtFixedRate(this::broadcastStatuses, 2, 2, TimeUnit.SECONDS);
    }

    @PreDestroy
    void shutdown() {
        scheduler.shutdownNow();
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        WebSocketSession safe = new ConcurrentWebSocketSessionDecorator(session, SEND_TIME_LIMIT_MS, BUFFER_SIZE_LIMIT);
        sessions.put(session.getId(), safe);
        log.debug("WS connected: {} (active sessions={})", session.getId(), sessions.size());
        try {
            send(safe, snapshotJson());
        } catch (Exception e) {
            log.debug("WS initial snapshot failed for {}: {}", session.getId(), e.getMessage());
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        sessions.remove(session.getId());
        log.debug("WS disconnected: {} status={} (active sessions={})",
                session.getId(), status, sessions.size());
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) {
        drop(sessions.getOrDefault(session.getId(), session));
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        // clients push no messages; server-push only
    }

    int activeSessions() {
        return sessions.size();
    }

    void broadcastStatuses() {
        if (sessions.isEmpty()) return;
        String json;
        try {
            json = snapshotJson();
        } catch (Exception e) {
            log.error("WS snapshot serialization failed", e);
            return;
        }

        long now = System.currentTimeMillis();
        if (json.equals(lastPayload) && now - lastSentAt < KEEPALIVE_MS) return;
        lastPayload = json;
        lastSentAt = now;

        for (WebSocketSession session : sessions.values()) {
            send(session, json);
        }
    }

    private String snapshotJson() {
        return objectMapper.writeValueAsString(trackingService.getAll());
    }

    private void send(WebSocketSession session, String json) {
        if (!session.isOpen()) {
            sessions.remove(session.getId());
            return;
        }
        try {
            session.sendMessage(new TextMessage(json));
        } catch (Exception e) {
            log.debug("WS send failed for {} — dropping session: {}", session.getId(), e.getMessage());
            drop(session);
        }
    }

    private void drop(WebSocketSession session) {
        sessions.remove(session.getId());
        try {
            if (session.isOpen()) session.close(CloseStatus.SESSION_NOT_RELIABLE);
        } catch (Exception ignored) {
            // already broken
        }
    }
}
