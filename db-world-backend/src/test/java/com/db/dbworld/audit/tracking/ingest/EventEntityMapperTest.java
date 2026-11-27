package com.db.dbworld.audit.tracking.ingest;

import com.db.dbworld.audit.tracking.aggregate.TrackEvent;
import com.db.dbworld.audit.tracking.entity.ActivityEventEntity;
import com.db.dbworld.audit.tracking.enums.ActivityKind;
import com.db.dbworld.audit.tracking.enums.TrackEventType;
import com.db.dbworld.audit.tracking.enums.TrackSource;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class EventEntityMapperTest {

    @Test
    void truncatesClientTextBeforeDatabaseInsert() {
        TrackEvent event = TrackEvent.builder()
                .sessionId("session")
                .activity(ActivityKind.STREAM)
                .type(TrackEventType.FAIL)
                .source(TrackSource.CLIENT)
                .errorCode("C".repeat(80))
                .errorMessage("M".repeat(800))
                .searchQuery("Q".repeat(400))
                .build();

        ActivityEventEntity entity = EventEntityMapper.toEntity(event);

        assertThat(entity.getErrorCode()).hasSize(40);
        assertThat(entity.getErrorMessage()).hasSize(512);
        assertThat(entity.getSearchQuery()).hasSize(256);
    }
}
