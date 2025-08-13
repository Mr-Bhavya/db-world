package com.db.dbworld.handler;
import com.db.dbworld.services.DownloadTrackerService;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

@Component
public class DownloadTrackerHandler extends TextWebSocketHandler {
    private final DownloadTrackerService trackerService;

    public DownloadTrackerHandler(DownloadTrackerService trackerService) {
        this.trackerService = trackerService;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        trackerService.addSession(session);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        trackerService.removeSession(session);
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        // Optional: Handle incoming messages if needed
    }
}