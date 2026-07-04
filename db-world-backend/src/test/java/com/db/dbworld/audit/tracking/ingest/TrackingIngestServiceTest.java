package com.db.dbworld.audit.tracking.ingest;

import com.db.dbworld.audit.tracking.aggregate.TrackEvent;
import com.db.dbworld.audit.tracking.config.TrackingProperties;
import com.db.dbworld.audit.tracking.enums.*;
import com.db.dbworld.audit.tracking.repository.ActivityEventRepository;
import com.db.dbworld.core.user.service.UserService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.orm.ObjectOptimisticLockingFailureException;

import java.time.Instant;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TrackingIngestServiceTest {

    @Mock ActivityEventRepository eventRepo;
    @Mock TrackingSessionWriter writer;
    @Mock TrackingProperties props;
    @Mock UserService userService;

    TrackingIngestService service;
    @org.junit.jupiter.api.BeforeEach void setUp() {
        service = new TrackingIngestService(eventRepo, writer, props, userService);
    }

    private TrackEvent resolve() {
        return TrackEvent.builder().sessionId("req-1").clientEventId("ce-1")
                .activity(ActivityKind.DOWNLOAD).type(TrackEventType.RESOLVE)
                .channel(TrackChannel.SERVER).clientApp(ClientApp.DBWORLD_APP).source(TrackSource.SERVER)
                .eventTime(Instant.now()).userId(7L).mediaFileId("mf-1").fileSize(100L).build();
    }

    @Test void ingest_disabled_doesNothing() {
        when(props.isEnabled()).thenReturn(false);
        service.ingest(resolve());
        verifyNoInteractions(eventRepo, writer);
    }

    @Test void ingest_duplicate_skipsPersist() {
        when(props.isEnabled()).thenReturn(true);
        when(eventRepo.existsBySessionIdAndClientEventId("req-1", "ce-1")).thenReturn(true);
        service.ingest(resolve());
        verify(writer, never()).applyEvent(any());
    }

    @Test void ingest_new_callsWriterOnce() {
        when(props.isEnabled()).thenReturn(true);
        when(eventRepo.existsBySessionIdAndClientEventId(any(), any())).thenReturn(false);
        service.ingest(resolve());
        verify(writer, times(1)).applyEvent(any(TrackEvent.class));
    }

    @Test void ingest_retriesOnOptimisticLockFailure_thenSucceeds() {
        when(props.isEnabled()).thenReturn(true);
        when(eventRepo.existsBySessionIdAndClientEventId(any(), any())).thenReturn(false);
        doThrow(new ObjectOptimisticLockingFailureException(Object.class, "req-1"))
                .doThrow(new ObjectOptimisticLockingFailureException(Object.class, "req-1"))
                .doNothing()
                .when(writer).applyEvent(any());

        service.ingest(resolve());

        verify(writer, times(3)).applyEvent(any(TrackEvent.class));
    }
}
