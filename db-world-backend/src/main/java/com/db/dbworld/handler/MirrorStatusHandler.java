package com.db.dbworld.handler;

import com.db.dbworld.payloads.MirrorStatus;
import com.db.dbworld.services.Impl.StatusServiceImpl;
import com.db.dbworld.services.StatusService;
import com.google.gson.Gson;
import lombok.extern.log4j.Log4j2;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Log4j2
public class MirrorStatusHandler extends TextWebSocketHandler {

    @Override
    public void handleTextMessage(WebSocketSession session, TextMessage message) {
        log.info("WebSocket Connection start for status");
        new Thread(() -> {
            try {
                while (session.isOpen()) {
                    StatusService statusService = new StatusServiceImpl();
                    Map<String, MirrorStatus> mirrorStatusMap = statusService.getAllStatus();
                    List<MirrorStatus> mirrorStatuses = new ArrayList<>();
                    mirrorStatuses.addAll(mirrorStatusMap.values().stream().sorted((o1, o2) -> o2.getTimeStamp().compareTo(o1.getTimeStamp())).toList());
                    session.sendMessage(new TextMessage(new Gson().toJson(mirrorStatuses)));
                    Thread.sleep(3000); // Simulate 25 fps (1000 ms / 25 = 40 ms)
                }
            } catch (IOException | InterruptedException e) {
                log.error(e.getMessage());
            }
        }).start();
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status){
        // Handle connection close
        log.info("WebSocket Connection close for status. status code: {}", status.getCode());
    }

}
