package com.db.dbworld.handler;

import com.db.dbworld.payloads.MirrorStatus;
import com.db.dbworld.services.StatusService;
import com.google.gson.Gson;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Log4j2
@Service
public class MirrorStatusHandler extends TextWebSocketHandler {

    private final StatusService statusService;
    private final ExecutorService executorService = Executors.newCachedThreadPool();

    @Autowired
    public MirrorStatusHandler(StatusService statusService) {
        this.statusService = statusService;
    }

    @Override
    public void handleTextMessage(WebSocketSession session, TextMessage message) {
        executorService.execute(() -> {
            try {
                while (session.isOpen()) {
                    Map<String, MirrorStatus> mirrorStatusMap = statusService.getAllStatus();
                    List<MirrorStatus> mirrorStatuses = mirrorStatusMap.values().stream()
                            .sorted((o1, o2) -> o2.getTimeStamp().compareTo(o1.getTimeStamp()))
                            .toList();

                    session.sendMessage(new TextMessage(new Gson().toJson(mirrorStatuses)));
                    Thread.sleep(3000); // Reduce CPU load
                }
            } catch (IOException | InterruptedException e) {
                log.error("WebSocket Error: {}", e.getMessage());
                Thread.currentThread().interrupt();
            }
        });
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        log.debug("WebSocket closed: {}", status);
    }
}