package com.db.dbworld.audit.tracking.ingest;

import com.db.dbworld.audit.tracking.aggregate.SessionAggregator;
import com.db.dbworld.audit.tracking.aggregate.TrackEvent;
import com.db.dbworld.audit.tracking.config.TrackingProperties;
import com.db.dbworld.audit.tracking.entity.ActivityEventEntity;
import com.db.dbworld.audit.tracking.entity.ActivitySessionEntity;
import com.db.dbworld.audit.tracking.enums.*;
import com.db.dbworld.audit.tracking.repository.ActivityEventRepository;
import com.db.dbworld.audit.tracking.repository.ActivitySessionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TrackingIngestServiceTest {

    @Mock ActivityEventRepository eventRepo;
    @Mock ActivitySessionRepository sessionRepo;
    @Mock TrackingProperties props;

    // remove @InjectMocks; construct manually so we use the REAL aggregator
    TrackingIngestService service;
    @org.junit.jupiter.api.BeforeEach void setUp() {
        service = new TrackingIngestService(eventRepo, sessionRepo, new SessionAggregator(), props);
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
        verifyNoInteractions(eventRepo, sessionRepo);
    }

    @Test void ingest_duplicate_skipsPersist() {
        when(props.isEnabled()).thenReturn(true);
        when(eventRepo.existsBySessionIdAndClientEventId("req-1", "ce-1")).thenReturn(true);
        service.ingest(resolve());
        verify(eventRepo, never()).save(any());
        verify(sessionRepo, never()).save(any());
    }

    @Test void ingest_new_persistsEventAndCreatesSession() {
        when(props.isEnabled()).thenReturn(true);
        when(eventRepo.existsBySessionIdAndClientEventId(any(), any())).thenReturn(false);
        when(sessionRepo.findById("req-1")).thenReturn(Optional.empty());
        service.ingest(resolve());
        verify(eventRepo).save(any(ActivityEventEntity.class));
        verify(sessionRepo).save(any(ActivitySessionEntity.class));
    }
}
