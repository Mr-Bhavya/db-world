package com.db.dbworld.logging;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * ============================================================
 *  LogWebSocketHandler
 * ============================================================
 *
 * WebSocket control plane for Log Streaming + History + Analytics
 *
 * -------------------------
 * SUPPORTED CLIENT ACTIONS
 * -------------------------
 *
 * 1) identify
 *    {
 *      "action": "identify",
 *      "clientId": "ui-1",          // optional
 *      "clientInfo": "react-ui"     // optional
 *    }
 *
 *    -> registers client metadata
 *    -> server responds: {action:"identified", clientId, serverTime}
 *
 *
 * 2) ping
 *    {
 *      "action": "ping",
 *      "timestamp": 1730000000
 *    }
 *
 *    -> latency + keepalive
 *    -> server responds with pong
 *
 *
 * 3) pong
 *    {
 *      "action": "pong",
 *      "timestamp": ...
 *    }
 *
 *    -> client reply to server_ping
 *    -> updates lastPong + pingCount
 *
 *
 * 4) history
 *    {
 *      "action": "history",
 *      "windowMs": 900000,   // optional, default 24h
 *      "limit": 10000,       // optional, max 50k
 *      "level": "INFO"       // optional
 *    }
 *
 *    -> async disk stream
 *    -> uses LogHistoryService
 *
 *
 * 5) analytics
 *    {
 *      "action": "analytics",
 *      "windowMs": 900000,
 *      "bucketMs": 60000,
 *      "level": "ERROR"
 *    }
 *
 *    -> server-side aggregation
 *    -> histogram result returned
 *
 *
 * -------------------------
 * SERVER CONTROL MESSAGES
 * -------------------------
 *
 * connected
 * identified
 * pong
 * error
 * stream_start
 * stream_progress
 * stream_keepalive
 * stream_complete
 *
 *
 * -------------------------
 * HARD LIMITS
 * -------------------------
 * message size = 1 MB
 * history limit <= 50k lines
 * async queue bounded
 *
 * ============================================================
 */

@Component
@RequiredArgsConstructor
@Log4j2
public class LogWebSocketHandler extends TextWebSocketHandler {

    private final LogBroadcastService broadcaster;
    private final LogHistoryService historyService;
    private final ObjectMapper mapper;

    // ---------- CONFIG ----------

    private static final int MAX_MESSAGE_SIZE = 1024 * 1024;

    // ---------- EXECUTORS (shared, bounded) ----------

    private final ExecutorService asyncExec =
            new ThreadPoolExecutor(
                    2,
                    8,
                    60,
                    TimeUnit.SECONDS,
                    new LinkedBlockingQueue<>(500),
                    new NamedFactory("ws-async"),
                    new ThreadPoolExecutor.CallerRunsPolicy()
            );

    // ---------- CLIENT STATE ----------

    private final Map<String, ClientInfo> clients = new ConcurrentHashMap<>();
    private final AtomicInteger connectionCounter = new AtomicInteger();

    private static class ClientInfo {

        final String clientId;
        final Instant connectedAt;
        final String info;

        final AtomicInteger pingCount = new AtomicInteger();

        volatile Instant lastPong;

        ClientInfo(String clientId, Instant connectedAt, String info) {
            this.clientId = clientId;
            this.connectedAt = connectedAt;
            this.info = info;
            this.lastPong = Instant.now();
        }
    }


    // =====================================================
    // CONNECTION
    // =====================================================

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {

        session.setTextMessageSizeLimit(MAX_MESSAGE_SIZE);

        int id = connectionCounter.incrementAndGet();

        String info = buildClientInfo(session);

        broadcaster.register(session, info);
        broadcaster.replayBuffer(session);

        safeSend(session,
                "{\"action\":\"connected\",\"connectionId\":" + id +
                        ",\"sessionId\":\"" + session.getId() +
                        "\",\"serverTime\":\"" + Instant.now() + "\"}");
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        clients.remove(session.getId());
        broadcaster.unregister(session);
    }

    private String buildClientInfo(WebSocketSession s) {
        return (s.getPrincipal()!=null?s.getPrincipal().getName():"anon")
                + "@"
                + (s.getRemoteAddress()!=null?s.getRemoteAddress().getHostString():"?");
    }

    // =====================================================
    // TRANSPORT ERROR
    // =====================================================

    @Override
    public void handleTransportError(WebSocketSession session, Throwable ex) {
        broadcaster.unregister(session);
        safeClose(session);
    }

    // =====================================================
    // MESSAGE DISPATCH (FAST ACTION PARSE)
    // =====================================================

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {

        String payload = message.getPayload();

        if (payload.length() > MAX_MESSAGE_SIZE) {
            safeClose(session);
            return;
        }

        // ---- fast action sniff (no full parse yet) ----

        String action = fastAction(payload);
        if (action == null) {
            sendError(session, "Missing action");
            return;
        }

        try {
            JsonNode req = mapper.readTree(payload);

            switch (action) {
                case "ping" -> handlePing(session, req);
                case "identify" -> handleIdentify(session, req);
                case "history" -> handleHistory(session, req);
                case "analytics" -> handleAnalytics(session, req);
                case "pong" -> handlePong(session, req);
                default -> sendError(session, "Unknown action");
            }

        } catch (Exception e) {
            sendError(session, "Invalid JSON");
        }
    }

    private String fastAction(String json) {
        int i = json.indexOf("\"action\"");
        if (i < 0) return null;
        int s = json.indexOf('"', i + 8);
        int e = json.indexOf('"', s + 1);
        if (s < 0 || e < 0) return null;
        return json.substring(s + 1, e);
    }

    // =====================================================
    // ACTIONS
    // =====================================================

    private void handlePing(WebSocketSession s, JsonNode req) {
        long ts = req.path("timestamp").asLong(System.currentTimeMillis());
        safeSend(s,
                "{\"action\":\"pong\",\"timestamp\":" + ts +
                        ",\"serverTime\":\"" + Instant.now() + "\"}");
    }

    private void handlePong(WebSocketSession s, JsonNode req) {
        ClientInfo c = clients.get(s.getId());
        if (c != null) {
            c.pingCount.incrementAndGet();
            c.lastPong = Instant.now();
        }
    }

    private void handleIdentify(WebSocketSession s, JsonNode req) {
        String cid = req.path("clientId")
                .asText("client-" + s.getId().hashCode());

        clients.put(
                s.getId(),
                new ClientInfo(
                        cid,
                        Instant.now(),
                        req.path("clientInfo").asText("?")
                )
        );

        safeSend(s,
                "{\"action\":\"identified\",\"clientId\":\"" + cid +
                        "\",\"serverTime\":\"" + Instant.now() + "\"}");
    }

    // =====================================================
    // HISTORY (window + limit support)
    // =====================================================

    private void handleHistory(WebSocketSession s, JsonNode req) {

        asyncExec.submit(() -> {
            try {
                long windowMs = req.path("windowMs").asLong(86_400_000);
                int limit = Math.min(req.path("limit").asInt(10_000), 50_000);
                String level = req.path("level").asText("INFO");

                Instant since = Instant.now().minusMillis(windowMs);

                historyService.streamHistory(s, since, level, limit);

            } catch (Exception e) {
                sendError(s, "History failed");
            }
        });
    }

    // =====================================================
    // ANALYTICS
    // =====================================================

    private void handleAnalytics(WebSocketSession s, JsonNode req) {

        asyncExec.submit(() -> {
            try {
                long windowMs = req.path("windowMs").asLong(900_000);
                long bucketMs = req.path("bucketMs").asLong(60_000);
                String level = req.path("level").asText("INFO");

                var result = historyService.aggregate(
                        Instant.now().minusMillis(windowMs),
                        level,
                        bucketMs
                );

                safeSend(s, mapper.writeValueAsString(result));

            } catch (Exception e) {
                sendError(s, "Analytics failed");
            }
        });
    }

    // =====================================================
    // SAFE SEND / CLOSE
    // =====================================================

    private void safeSend(WebSocketSession s, String m) {
        if (s == null || !s.isOpen()) return;
        try {
            synchronized (s) {
                if (s.isOpen())
                    s.sendMessage(new TextMessage(m));
            }
        } catch (Exception ignore) {
            safeClose(s);
        }
    }

    private void sendError(WebSocketSession s, String msg) {
        safeSend(s,
                "{\"action\":\"error\",\"message\":\"" +
                        msg.replace("\"","'") + "\"}");
    }

    private void safeClose(WebSocketSession s) {
        try { if (s.isOpen()) s.close(); } catch (Exception ignore) {}
    }

    @Override
    public boolean supportsPartialMessages() {
        return false;
    }

    // =====================================================
    // THREAD FACTORY
    // =====================================================

    static class NamedFactory implements ThreadFactory {
        private final String name;
        private final AtomicInteger c = new AtomicInteger();
        NamedFactory(String n){name=n;}
        public Thread newThread(Runnable r){
            Thread t=new Thread(r,name+"-"+c.incrementAndGet());
            t.setDaemon(true);
            return t;
        }
    }
}
