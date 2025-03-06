package com.db.dbworld.handler;

import com.db.dbworld.payloads.ApiResponse;
import com.db.dbworld.services.Impl.DownloadTrackerServiceImpl;
import com.google.gson.Gson;
import lombok.extern.log4j.Log4j2;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Log4j2
@Service
public class DownloadTrackerHandler extends TextWebSocketHandler {

    private final DownloadTrackerServiceImpl downloadTrackerService;
    private final ExecutorService executorService = Executors.newCachedThreadPool();

    public DownloadTrackerHandler(DownloadTrackerServiceImpl downloadTrackerService) {
        this.downloadTrackerService = downloadTrackerService;
    }

    @Override
    public void handleTextMessage(WebSocketSession session, TextMessage message) {
        executorService.execute(() -> {
            try {
                while (session.isOpen()) {
                    session.sendMessage(new TextMessage(new Gson().toJson(
                            new ApiResponse<>(HttpStatus.OK, true, "All Download Status", downloadTrackerService.getAllDownloadStatus()))));
                    Thread.sleep(3000);
                }
            } catch (IOException | InterruptedException e) {
                log.error("WebSocket Error: {}", e.getMessage());
                Thread.currentThread().interrupt();
            }
        });
    }
}
