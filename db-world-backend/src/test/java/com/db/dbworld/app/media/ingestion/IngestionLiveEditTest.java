package com.db.dbworld.app.media.ingestion;

import com.db.dbworld.app.media.ingestion.model.IngestionContext;
import com.db.dbworld.app.media.ingestion.model.IngestionRequest;
import com.db.dbworld.app.media.ingestion.model.JobEditRequest;
import com.db.dbworld.app.media.ingestion.store.IngestionJobStore;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Live-edit mechanics for in-flight ingestion jobs: the store applies processing-tier fields always
 * but download-tier fields only when allowed (the QUEUED phase), and the context reads the record
 * link live so a mid-flight re-link is honoured at processing time.
 */
class IngestionLiveEditTest {

    private static IngestionRequest baseRequest() {
        IngestionRequest r = new IngestionRequest();
        r.setUri("http://old");
        r.setRecordId(1L);
        r.setSeason(1);
        r.setEpisode(1);
        return r;
    }

    @Test
    void applyEdit_unknownJob_returnsFalse() {
        IngestionJobStore store = new IngestionJobStore();
        assertThat(store.applyEdit("missing", new JobEditRequest(), true)).isFalse();
    }

    @Test
    void applyEdit_processingTierApplied_downloadTierIgnoredWhenNotAllowed() {
        IngestionJobStore store = new IngestionJobStore();
        store.register("j1", baseRequest());

        JobEditRequest edit = new JobEditRequest();
        edit.setRecordId(42L);
        edit.setSeason(2);
        edit.setEpisode(9);
        edit.setExtract(true);
        edit.setRename(true);
        edit.setFileName("new.mkv");
        // download-tier fields present, but not allowed this phase
        edit.setUri("http://new");
        edit.setVideoQuality("1080");

        assertThat(store.applyEdit("j1", edit, false)).isTrue();

        IngestionRequest r = store.getRequest("j1").orElseThrow();
        assertThat(r.getRecordId()).isEqualTo(42L);
        assertThat(r.getSeason()).isEqualTo(2);
        assertThat(r.getEpisode()).isEqualTo(9);
        assertThat(r.getExtract()).isTrue();
        assertThat(r.getRename()).isTrue();
        assertThat(r.getFileName()).isEqualTo("new.mkv");
        // download-tier left untouched (not the QUEUED phase)
        assertThat(r.getUri()).isEqualTo("http://old");
        assertThat(r.getVideoQuality()).isNull();
    }

    @Test
    void applyEdit_downloadTierApplied_whenAllowed() {
        IngestionJobStore store = new IngestionJobStore();
        store.register("j2", baseRequest());

        JobEditRequest edit = new JobEditRequest();
        edit.setUri("http://new");
        edit.setVideoQuality("720");
        edit.setFolderName("Movies");

        store.applyEdit("j2", edit, true);

        IngestionRequest r = store.getRequest("j2").orElseThrow();
        assertThat(r.getUri()).isEqualTo("http://new");
        assertThat(r.getVideoQuality()).isEqualTo("720");
        assertThat(r.getFolderName()).isEqualTo("Movies");
    }

    @Test
    void applyEdit_nullFields_leaveExistingUnchanged() {
        IngestionJobStore store = new IngestionJobStore();
        store.register("j3", baseRequest());

        store.applyEdit("j3", new JobEditRequest(), true); // everything null

        IngestionRequest r = store.getRequest("j3").orElseThrow();
        assertThat(r.getRecordId()).isEqualTo(1L);
        assertThat(r.getSeason()).isEqualTo(1);
        assertThat(r.getUri()).isEqualTo("http://old");
    }

    @Test
    void context_recordId_readsLiveFromRequest_soRelinkIsHonoured() {
        IngestionContext ctx = new IngestionContext();
        IngestionRequest req = baseRequest();
        ctx.setRequest(req);
        ctx.setRecordId(1L);

        assertThat(ctx.getRecordId()).isEqualTo(1L);

        req.setRecordId(99L); // simulate a live re-link while the job is still downloading
        assertThat(ctx.getRecordId()).isEqualTo(99L);
    }
}
