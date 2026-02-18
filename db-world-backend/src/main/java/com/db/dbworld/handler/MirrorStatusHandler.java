package com.db.dbworld.handler;

import com.db.dbworld.payloads.MirrorStatus;
import com.db.dbworld.services.mirror.HttpDownloadQueueService;
import com.db.dbworld.services.mirror.StatusService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.*;
import java.util.concurrent.*;

@Service
@Log4j2
public class MirrorStatusHandler extends TextWebSocketHandler {

    private final StatusService statusService;
    private final HttpDownloadQueueService httpDownloadQueueService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    // All connected clients
    private final Set<WebSocketSession> sessions = ConcurrentHashMap.newKeySet();

    // Single scheduler for all clients
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();

    @Autowired
    public MirrorStatusHandler(StatusService statusService,
                               HttpDownloadQueueService httpDownloadQueueService) {
        this.statusService = statusService;
        this.httpDownloadQueueService = httpDownloadQueueService;

        // Push updates every 2 seconds
        scheduler.scheduleAtFixedRate(
                this::broadcastStatuses,
                0,
                2,
                TimeUnit.SECONDS
        );
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        sessions.add(session);
        log.debug("WS connected: {}", session.getId());
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        sessions.remove(session);
        log.debug("WS disconnected: {}", session.getId());
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        // No-op (client doesn't need to send anything)
    }

    /* =========================================================
       BROADCAST LOOP
       ========================================================= */

    private void broadcastStatuses() {
        try {
            if (sessions.isEmpty()) return;

            List<String> queueSnapshot = httpDownloadQueueService.getQueueSnapshot();

            List<Map<String, Object>> payload =
                    statusService.getAllStatus()
                            .values()
                            .stream()
                            .sorted(Comparator.comparing(MirrorStatus::getTimeStamp).reversed())
                            .map(status -> {

                                Map<String, Object> map = new HashMap<>();
                                map.put("status", status);

                                int idx = queueSnapshot.indexOf(status.getId());
                                boolean isQueued = idx >= 0;

                                map.put("isQueued", isQueued);
                                map.put("queuePosition", isQueued ? idx + 1 : null);
                                map.put("isRunning", status.getId().equals(httpDownloadQueueService.getCurrentlyRunningId()));

                                return map;
                            })
                            .toList();

            String json = objectMapper.writeValueAsString(payload);

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