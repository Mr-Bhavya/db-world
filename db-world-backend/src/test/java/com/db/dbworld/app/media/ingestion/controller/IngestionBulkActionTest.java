package com.db.dbworld.app.media.ingestion.controller;

import com.db.dbworld.app.media.ingestion.tracking.MirrorStatus;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class IngestionBulkActionTest {

    private static Map<String, Object> live() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("ok", Map.of("status", MirrorStatus.SUCCESS));
        m.put("bad", Map.of("status", MirrorStatus.FAILED));
        m.put("stop", Map.of("status", "CANCELLED"));
        m.put("dl", Map.of("status", MirrorStatus.DOWNLOADING));
        m.put("hold", Map.of("status", MirrorStatus.PAUSED));
        m.put("proc", Map.of("status", MirrorStatus.PROCESSING));
        m.put("junk", "not-a-map");
        return m;
    }

    @Test
    void selectsOnlyJobsInMatchingStatuses() {
        assertThat(IngestionBulkAction.CLEAR_FINISHED.targets(live())).containsExactly("ok", "bad", "stop");
        assertThat(IngestionBulkAction.RETRY_FAILED.targets(live())).containsExactly("bad");
        assertThat(IngestionBulkAction.PAUSE_ALL.targets(live())).containsExactly("dl");
        assertThat(IngestionBulkAction.RESUME_ALL.targets(live())).containsExactly("hold");
    }

    @Test
    void parsesKebabCasePathAndRejectsUnknown() {
        assertThat(IngestionBulkAction.fromPath("clear-finished")).contains(IngestionBulkAction.CLEAR_FINISHED);
        assertThat(IngestionBulkAction.fromPath("Retry-Failed")).contains(IngestionBulkAction.RETRY_FAILED);
        assertThat(IngestionBulkAction.fromPath("drop-table")).isEmpty();
        assertThat(IngestionBulkAction.fromPath(null)).isEmpty();
    }
}
