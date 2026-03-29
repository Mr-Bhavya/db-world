package com.db.dbworld.app.media.aria2.model;

import lombok.Getter;
import lombok.Setter;
import org.springframework.web.socket.WebSocketSession;

import java.time.LocalDateTime;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Mutable state holder for a single WebSocket connection to Aria2.
 * All atomic fields are thread-safe; non-atomic fields should only be written
 * from the connection thread and read under the connected check.
 */
@Getter
@Setter
public class WebSocketConnectionState {

    private WebSocketSession session;
    private final AtomicBoolean  isConnected       = new AtomicBoolean(false);
    private final AtomicInteger  reconnectAttempts = new AtomicInteger(0);
    private final AtomicInteger  messageId         = new AtomicInteger(1);
    private final AtomicLong     lastActivityTime  = new AtomicLong(System.currentTimeMillis());

    private LocalDateTime connectionTime;
    private String        connectionId;
    private int           activeDownloadsCount;

    public void updateActivity() {
        lastActivityTime.set(System.currentTimeMillis());
    }

    public long getInactiveDuration() {
        return System.currentTimeMillis() - lastActivityTime.get();
    }

    public boolean shouldReconnect(int maxAttempts) {
        return reconnectAttempts.get() < maxAttempts && activeDownloadsCount > 0;
    }

    public void incrementReconnectAttempts() { reconnectAttempts.incrementAndGet(); }
    public void resetReconnectAttempts()      { reconnectAttempts.set(0); }
    public int  getNextMessageId()            { return messageId.getAndIncrement(); }
}
