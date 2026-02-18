package com.db.dbworld.logging;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.time.Instant;
import java.util.Set;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

@Service
@Log4j2
public class LogBroadcastService {

    // =====================================================
    // CONFIG
    // =====================================================

    private static final int BUFFER_SIZE = 5000;
    private static final int MAX_SESSIONS = 1000;

    // =====================================================
    // SESSION REGISTRY
    // =====================================================

    private final Set<WebSocketSession> sessions =
            ConcurrentHashMap.newKeySet();

    // =====================================================
    // LOCK-FREE RING BUFFER
    // =====================================================

    private final String[] ring = new String[BUFFER_SIZE];
    private final AtomicInteger ringPos = new AtomicInteger();

    // =====================================================
    // EXECUTORS
    // =====================================================

    private final ExecutorService senderPool =
            new ThreadPoolExecutor(
                    4,
                    12,
                    60,
                    TimeUnit.SECONDS,
                    new ArrayBlockingQueue<>(20000),
                    new NamedFactory("ws-send"),
                    new ThreadPoolExecutor.DiscardPolicy() // drop if overloaded
            );

    private final ScheduledExecutorService scheduler =
            Executors.newSingleThreadScheduledExecutor(
                    new NamedFactory("ws-keepalive"));

    // =====================================================
    // INIT
    // =====================================================

    @PostConstruct
    void init() {
        scheduler.scheduleAtFixedRate(
                this::sendKeepAliveAll,
                20, 20,
                TimeUnit.SECONDS
        );
    }

    // =====================================================
    // REGISTER / UNREGISTER
    // =====================================================

    public void register(WebSocketSession session, String info) {
        if (sessions.size() >= MAX_SESSIONS) {
            safeClose(session);
            return;
        }
        sessions.add(session);
    }

    public void unregister(WebSocketSession session) {
        sessions.remove(session);
    }

    // =====================================================
    // BROADCAST — OPTIMIZED FANOUT
    // =====================================================

    public void broadcast(String message) {

        cache(message);

        if (sessions.isEmpty()) return;

        final TextMessage msg = new TextMessage(message);

        sessions.removeIf(s -> !s.isOpen());

        // batch submit instead of per-session task explosion
        senderPool.execute(() -> {
            for (WebSocketSession s : sessions) {
                if (!s.isOpen()) continue;
                try {
                    synchronized (s) {
                        if (s.isOpen()) s.sendMessage(msg);
                    }
                } catch (Exception e) {
                    sessions.remove(s);
                }
            }
        });
    }

    // =====================================================
    // LOCK-FREE CACHE WRITE
    // =====================================================

    private void cache(String message) {
        int p = ringPos.getAndIncrement();
        ring[p % BUFFER_SIZE] = message;
    }

    // =====================================================
    // SNAPSHOT REPLAY
    // =====================================================

    public void replayBuffer(WebSocketSession s) {
        if (!s.isOpen()) return;

        int end = ringPos.get();
        int start = Math.max(0, end - BUFFER_SIZE);

        for (int i = start; i < end; i++) {
            String m = ring[i % BUFFER_SIZE];
            if (m != null) safeSend(s, m);
        }
    }

    // =====================================================
    // KEEPALIVE — SHARED SCHEDULER
    // =====================================================

    private void sendKeepAliveAll() {
        String ping = "{\"action\":\"server_ping\",\"t\":\"" +
                Instant.now() + "\"}";

        TextMessage msg = new TextMessage(ping);

        sessions.removeIf(s -> !s.isOpen());

        for (WebSocketSession s : sessions) {
            try {
                synchronized (s) {
                    if (s.isOpen()) s.sendMessage(msg);
                }
            } catch (Exception e) {
                sessions.remove(s);
            }
        }
    }

    // =====================================================
    // SAFE SEND
    // =====================================================

    private void safeSend(WebSocketSession s, String m) {
        if (!s.isOpen()) return;
        try {
            synchronized (s) {
                if (s.isOpen())
                    s.sendMessage(new TextMessage(m));
            }
        } catch (Exception e) {
            sessions.remove(s);
        }
    }

    private void safeClose(WebSocketSession s) {
        try { if (s.isOpen()) s.close(); } catch (Exception ignore) {}
        sessions.remove(s);
    }

    public int getActiveSessions() {
        return sessions.size();
    }

    // =====================================================
    // SHUTDOWN
    // =====================================================

    @PreDestroy
    void shutdown() {
        scheduler.shutdownNow();
        senderPool.shutdownNow();
        sessions.forEach(this::safeClose);
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
