package com.db.dbworld.app.media.download.ws;

import com.db.dbworld.app.media.ingestion.tracking.TrackingService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class MirrorStatusHandlerTest {

    TrackingService tracking = mock(TrackingService.class);
    Map<String, Object> state = new HashMap<>();
    MirrorStatusHandler handler;

    MirrorStatusHandlerTest() {
        when(tracking.getAll()).thenAnswer(inv -> new HashMap<>(state));
        handler = new MirrorStatusHandler(tracking, false);
    }

    @AfterEach
    void tearDown() {
        handler.shutdown();
    }

    private static WebSocketSession session(String id) {
        WebSocketSession s = mock(WebSocketSession.class);
        when(s.getId()).thenReturn(id);
        when(s.isOpen()).thenReturn(true);
        return s;
    }

    @Test
    void sendsSnapshotOnConnectAndSkipsUnchangedBroadcasts() throws Exception {
        WebSocketSession s = session("1");
        handler.afterConnectionEstablished(s);
        verify(s, times(1)).sendMessage(any(TextMessage.class));

        handler.broadcastStatuses();   // first broadcast — payload not yet recorded
        handler.broadcastStatuses();   // unchanged → skipped
        verify(s, times(2)).sendMessage(any(TextMessage.class));

        state.put("job", Map.of("progress", 5));
        handler.broadcastStatuses();
        verify(s, times(3)).sendMessage(any(TextMessage.class));
    }

    @Test
    void failingSessionIsDroppedWithoutBlockingOthers() throws Exception {
        WebSocketSession bad = session("bad");
        WebSocketSession good = session("good");
        handler.afterConnectionEstablished(good);
        handler.afterConnectionEstablished(bad);
        doThrow(new IOException("broken pipe")).when(bad).sendMessage(any());

        state.put("job", Map.of("progress", 1));
        handler.broadcastStatuses();

        verify(good, times(2)).sendMessage(any(TextMessage.class));
        assertThat(handler.activeSessions()).isEqualTo(1);
    }

    @Test
    void closedSessionIsRemoved() {
        WebSocketSession s = session("1");
        handler.afterConnectionEstablished(s);
        handler.afterConnectionClosed(s, CloseStatus.NORMAL);
        assertThat(handler.activeSessions()).isZero();
    }
}
