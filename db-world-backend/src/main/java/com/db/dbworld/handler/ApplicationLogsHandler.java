package com.db.dbworld.handler;

import com.db.dbworld.payloads.ApiResponse;
import com.db.dbworld.utils.DbWorldConstants;
import com.db.dbworld.utils.DbWorldUtils;
import com.google.gson.Gson;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.util.List;

@Log4j2
public class ApplicationLogsHandler extends TextWebSocketHandler {

    @Autowired
    private DbWorldUtils dbWorldUtils;

    @Override
    public void handleTextMessage(WebSocketSession session, TextMessage message) {
//        log.info("WebSocket Connection start for application logs");
        new Thread(() -> {
            try {
                while (session.isOpen()) {
                    DbWorldUtils dbWorldUtils1 = new DbWorldUtils();
                    List<String> logs = dbWorldUtils1.readFileInList(DbWorldConstants.LOGS_FILE_PATH);
                    session.sendMessage(new TextMessage(new Gson().toJson(new ApiResponse<>(HttpStatus.OK, true, "Info Logs", logs))));
                    Thread.sleep(2000); // Simulate 25 fps (1000 ms / 25 = 40 ms)
                }
            } catch (InterruptedException | IOException e) {
                log.error(e.getMessage());
            }
        }).start();
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status){
        // Handle connection close
//        log.info("WebSocket Connection close for application logs. status code: {}", status.getCode());
    }
}
