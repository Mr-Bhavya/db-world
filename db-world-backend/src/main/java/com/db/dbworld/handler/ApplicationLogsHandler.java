package com.db.dbworld.handler;

import com.db.dbworld.payloads.ApiResponse;
import com.db.dbworld.utils.DbWorldConstants;
import com.db.dbworld.utils.DbWorldUtils;
import com.google.gson.Gson;
import lombok.extern.log4j.Log4j2;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Log4j2
@Service
public class ApplicationLogsHandler extends TextWebSocketHandler {

    private final DbWorldUtils dbWorldUtils;
    private final ExecutorService executorService = Executors.newCachedThreadPool();

    public ApplicationLogsHandler(DbWorldUtils dbWorldUtils) {
        this.dbWorldUtils = dbWorldUtils;
    }

    @Override
    public void handleTextMessage(WebSocketSession session, TextMessage message) {
        executorService.execute(() -> {
            try {
                while (session.isOpen()) {
                    List<String> logs = dbWorldUtils.readFileInList(DbWorldConstants.LOGS_FILE_PATH);
                    session.sendMessage(new TextMessage(new Gson().toJson(new ApiResponse<>(HttpStatus.OK, true, "Info Logs", logs))));
                    Thread.sleep(3000);
                }
            } catch (IOException | InterruptedException e) {
                log.error("WebSocket Error: {}", e.getMessage());
                Thread.currentThread().interrupt();
            }
        });
    }
}
