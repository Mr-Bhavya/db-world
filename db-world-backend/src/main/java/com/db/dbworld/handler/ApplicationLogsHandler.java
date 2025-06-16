package com.db.dbworld.handler;

import com.db.dbworld.payloads.ApiResponse;
import com.db.dbworld.utils.DbWorldConstants;
import com.db.dbworld.utils.DbWorldUtils;
import com.google.gson.Gson;
import lombok.extern.log4j.Log4j2;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.*;
import java.util.stream.Collectors;

@Log4j2
@Service
public class ApplicationLogsHandler extends TextWebSocketHandler {

    private final DbWorldUtils dbWorldUtils;
    private final Gson gson = new Gson();

    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(1);
    private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();
    private final Map<String, Long> sessionLookbackMinutes = new ConcurrentHashMap<>();
    private final Map<String, Long> sessionLastReadPositions = new ConcurrentHashMap<>();

    private final DateTimeFormatter logTimestampFormat = DateTimeFormatter.ofPattern("MM/dd/yyyy hh:mm:ss.SSS a");

    public ApplicationLogsHandler(DbWorldUtils dbWorldUtils) {
        this.dbWorldUtils = dbWorldUtils;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        String sessionId = session.getId();

        sessions.put(sessionId, session);
        sessionLookbackMinutes.put(sessionId, 60L); // Default lookback 1 hour
        sessionLastReadPositions.put(sessionId, 0L);

//        log.info("WebSocket connection established: {}", sessionId);

        sendInitialLogs(sessionId);

        scheduler.scheduleAtFixedRate(() -> sendNewLogs(sessionId), 5, 5, TimeUnit.SECONDS);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String sessionId = session.getId();
        sessions.remove(sessionId);
        sessionLookbackMinutes.remove(sessionId);
        sessionLastReadPositions.remove(sessionId);

//        log.info("WebSocket connection closed: {}", sessionId);
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        String sessionId = session.getId();

        try {
            Map<String, Object> request = gson.fromJson(message.getPayload(), Map.class);
            String action = (String) request.get("action");

            if ("get_older_logs".equals(action)) {
                Number minutes = (Number) request.get("minutes");
                if (minutes != null) {
                    sessionLookbackMinutes.put(sessionId, minutes.longValue());
                    sendOlderLogs(sessionId);
                }
            }

        } catch (Exception e) {
            log.error("Error processing WebSocket message: {}", e.getMessage());
            sendErrorMessage(session, "Invalid request");
        }
    }

    private void sendInitialLogs(String sessionId) {
        WebSocketSession session = sessions.get(sessionId);
        if (!isSessionOpen(session)) return;

        long lookbackMinutes = sessionLookbackMinutes.getOrDefault(sessionId, 60L);
        List<String> logs = getLogsWithinTimeframe(lookbackMinutes);

        Map<String, Object> response = createResponse("initial_logs", "Logs retrieved", logs);
        sendMessage(session, response);
    }

    private void sendNewLogs(String sessionId) {
        WebSocketSession session = sessions.get(sessionId);
        if (!isSessionOpen(session)) return;

        try {
            List<String> allLogs = dbWorldUtils.readFileInList(DbWorldConstants.LOGS_FILE_PATH);
            long lastPosition = sessionLastReadPositions.getOrDefault(sessionId, 0L);

            if (allLogs.size() > lastPosition) {
                List<String> newLines = allLogs.subList((int) lastPosition, allLogs.size());
                sessionLastReadPositions.put(sessionId, (long) allLogs.size());

                List<Map<String, Object>> parsedLogs = newLines.stream()
                        .map(this::parseLogLine)
                        .filter(Objects::nonNull)
                        .collect(Collectors.toList());

                Map<String, Object> response = createResponse("new_log", null, parsedLogs);
                sendMessage(session, response);
            }

        } catch (Exception e) {
            log.error("Error sending new logs to session {}: {}", sessionId, e.getMessage());
        }
    }

    private Map<String, Object> parseLogLine(String jsonLine) {
        try {
            return gson.fromJson(jsonLine, Map.class);
        } catch (Exception e) {
            log.warn("Failed to parse log line: {}", jsonLine);
            return null;
        }
    }

    private boolean isAfterCutoff(String timestampStr, LocalDateTime cutoff) {
        try {
            // Adjust this format based on your JsonLayout timestamp format, e.g., ISO8601
            LocalDateTime logTime = LocalDateTime.parse(timestampStr);
            return logTime.isAfter(cutoff);
        } catch (Exception e) {
            return false;
        }
    }



    private void sendOlderLogs(String sessionId) {
        WebSocketSession session = sessions.get(sessionId);
        if (!isSessionOpen(session)) return;

        long lookbackMinutes = sessionLookbackMinutes.getOrDefault(sessionId, 120L);
        List<String> olderLogs = getLogsWithinTimeframe(lookbackMinutes);

        Map<String, Object> response = createResponse("older_logs", null, olderLogs);
        sendMessage(session, response);
    }

    private List<String> getLogsWithinTimeframe(long minutes) {
        List<String> allLines = dbWorldUtils.readFileInList(DbWorldConstants.LOGS_FILE_PATH);
        LocalDateTime cutoff = LocalDateTime.now().minusMinutes(minutes);

        return allLines.stream()
                .map(this::parseLogLine)
                .filter(Objects::nonNull)
                .filter(log -> log.get("timestamp") != null && isAfterCutoff(log.get("timestamp").toString(), cutoff))
                .map(gson::toJson)
                .collect(Collectors.toList());
    }

    private void sendMessage(WebSocketSession session, Map<String, Object> response) {
        try {
            session.sendMessage(new TextMessage(gson.toJson(response)));
        } catch (IOException e) {
            log.error("Failed to send message: {}", e.getMessage());
        }
    }

    private void sendErrorMessage(WebSocketSession session, String errorMessage) {
        ApiResponse<Object> error = new ApiResponse<>(HttpStatus.BAD_REQUEST, false, errorMessage, null);
        try {
            session.sendMessage(new TextMessage(gson.toJson(error)));
        } catch (IOException e) {
            log.error("Failed to send error message: {}", e.getMessage());
        }
    }

    private boolean isSessionOpen(WebSocketSession session) {
        return session != null && session.isOpen();
    }

    private Map<String, Object> createResponse(String type, String message, List<?> data) {
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("type", type);
        if (message != null) response.put("message", message);
        response.put("data", data != null ? data : Collections.emptyList());
        return response;
    }
}
