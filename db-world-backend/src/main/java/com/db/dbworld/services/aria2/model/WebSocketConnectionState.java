package com.db.dbworld.services.aria2.model;

import lombok.Data;
import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;
import org.springframework.web.socket.WebSocketSession;

import java.time.LocalDateTime;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class WebSocketConnectionState {
    private WebSocketSession session;
    private AtomicBoolean isConnected = new AtomicBoolean(false);
    private AtomicInteger reconnectAttempts = new AtomicInteger(0);
    private AtomicInteger messageId = new AtomicInteger(1);
    private AtomicLong lastActivityTime = new AtomicLong(System.currentTimeMillis());
    private LocalDateTime connectionTime;
    private String connectionId;
    private int activeDownloadsCount;

    public void updateActivity() {
        lastActivityTime.set(System.currentTimeMillis());
    }

    public long getInactiveDuration() {
        return System.currentTimeMillis() - lastActivityTime.get();
    }

    public boolean shouldReconnect(int maxAttempts) {
        return reconnectAttempts.get() < maxAttempts && activeDownloadsCount > 0;
    }

    public void incrementReconnectAttempts() {
        reconnectAttempts.incrementAndGet();
    }

    public void resetReconnectAttempts() {
        reconnectAttempts.set(0);
    }

    public int getNextMessageId() {
        return messageId.getAndIncrement();
    }
}