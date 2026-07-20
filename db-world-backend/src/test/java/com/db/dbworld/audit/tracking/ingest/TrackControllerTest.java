package com.db.dbworld.audit.tracking.ingest;

import com.db.dbworld.api.response.ApiResponse;
import com.db.dbworld.audit.tracking.aggregate.TrackEvent;
import com.db.dbworld.audit.tracking.enums.TrackChannel;
import com.db.dbworld.audit.tracking.enums.TrackSource;
import com.db.dbworld.audit.tracking.ingest.dto.TrackBatchRequest;
import com.db.dbworld.audit.tracking.ingest.dto.TrackEventRequest;
import com.db.dbworld.core.context.UserContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TrackControllerTest {

    @Mock TrackingIngestService trackingIngestService;
    @Mock UserContext userContext;

    TrackController controller;

    @BeforeEach
    void setUp() {
        controller = new TrackController(trackingIngestService, userContext);
    }

    private TrackEventRequest validEvent(String clientEventId) {
        return new TrackEventRequest(
                clientEventId, "session-1", "STREAM", "STREAM_START", "DBWORLD_APP",
                null, "mf-1", 42L, 1, 3, "episode.mkv", 12345L, 6789L, 1000L, 4,
                5000L, 60000L, new BigDecimal("10.5"), null, null, null, null);
    }

    @Test
    void ingest_validBatch_callsIngestForEachEventWithMappedFields() {
        when(userContext.userId()).thenReturn(7L);
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("User-Agent", "dbworld-android/1.0");
        request.setRemoteAddr("10.0.0.5");

        TrackBatchRequest body = new TrackBatchRequest(List.of(validEvent("ce-1"), validEvent("ce-2")));

        ApiResponse<Map<String, Object>> response = controller.ingest(body, "app", request);

        ArgumentCaptor<TrackEvent> captor = ArgumentCaptor.forClass(TrackEvent.class);
        verify(trackingIngestService, times(2)).ingest(captor.capture());

        List<TrackEvent> captured = captor.getAllValues();
        assertThat(captured).hasSize(2);
        for (TrackEvent event : captured) {
            assertThat(event.source()).isEqualTo(TrackSource.CLIENT);
            assertThat(event.userId()).isEqualTo(7L);
            assertThat(event.channel()).isEqualTo(TrackChannel.APP);
            assertThat(event.sessionId()).isEqualTo("session-1");
            assertThat(event.mediaFileId()).isEqualTo("mf-1");
            assertThat(event.remoteAddr()).isEqualTo("10.0.0.5");
            assertThat(event.userAgent()).isEqualTo("dbworld-android/1.0");
        }

        assertThat(response.getData()).containsEntry("accepted", 2);
    }

    @Test
    void ingest_unknownEventType_isSkipped() {
        when(userContext.userId()).thenReturn(7L);
        MockHttpServletRequest request = new MockHttpServletRequest();

        TrackEventRequest badType = new TrackEventRequest(
                "ce-bad", "session-1", "STREAM", "NOT_A_REAL_TYPE", "DBWORLD_APP",
                null, null, null, null, null, null, null, null, null, null,
                null, null, null, null, null, null, null);

        TrackBatchRequest bodyBad = new TrackBatchRequest(List.of(badType));
        ApiResponse<Map<String, Object>> responseBad = controller.ingest(bodyBad, "web", request);

        verifyNoInteractions(trackingIngestService);
        assertThat(responseBad.getData()).containsEntry("accepted", 0);

        // sanity: a mixed batch only ingests the valid one
        TrackBatchRequest mixed = new TrackBatchRequest(List.of(badType, validEvent("ce-good")));
        ApiResponse<Map<String, Object>> responseMixed = controller.ingest(mixed, "web", request);

        verify(trackingIngestService, times(1)).ingest(org.mockito.ArgumentMatchers.any());
        assertThat(responseMixed.getData()).containsEntry("accepted", 1);
    }

    @Test
    void ingest_emptyEvents_acceptsZeroAndNeverCallsIngest() {
        MockHttpServletRequest request = new MockHttpServletRequest();

        ApiResponse<Map<String, Object>> response = controller.ingest(new TrackBatchRequest(List.of()), null, request);

        assertThat(response.getData()).containsEntry("accepted", 0);
        verifyNoInteractions(trackingIngestService, userContext);
    }

    @Test
    void ingest_nullEventsList_acceptsZero() {
        MockHttpServletRequest request = new MockHttpServletRequest();

        ApiResponse<Map<String, Object>> response = controller.ingest(new TrackBatchRequest(null), null, request);

        assertThat(response.getData()).containsEntry("accepted", 0);
        verifyNoInteractions(trackingIngestService, userContext);
    }
}
