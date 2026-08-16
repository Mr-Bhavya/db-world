package com.db.dbworld.app.media.ingestion;

import com.db.dbworld.app.media.enrichment.TrackFilter;
import com.db.dbworld.app.media.ingestion.model.TrackReviewOptions;
import com.db.dbworld.app.media.ingestion.model.TrackReviewSelection;
import com.db.dbworld.app.media.ingestion.tracking.TrackReviewCoordinator;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The interactive track-review handshake: the coordinator's park/submit/timeout/cancel behaviour
 * and the selection→{@link TrackFilter} mapping.
 */
class IngestionTrackReviewTest {

    private final TrackReviewCoordinator coordinator = new TrackReviewCoordinator();

    private TrackReviewOptions opts(String jobId) {
        return new TrackReviewOptions(jobId, List.of(), List.of(), null,
                new TrackReviewOptions.Selection(List.of("hin"), List.of(), "hin", false, true),
                System.currentTimeMillis() + 60_000);
    }

    @Test
    void submitUnparksWithChosenFilter() throws Exception {
        String jobId = "job-submit";
        TrackFilter fallback = TrackFilter.builder().explicit(true).build();
        TrackFilter chosen = TrackFilter.builder().keepAudioLanguages(List.of("eng")).explicit(true).build();

        CompletableFuture<TrackFilter> awaiting = CompletableFuture.supplyAsync(() ->
                coordinator.awaitSelection(jobId, opts(jobId), fallback, Duration.ofSeconds(5)));

        waitUntilPending(jobId);
        assertThat(coordinator.isPending(jobId)).isTrue();
        assertThat(coordinator.getOptions(jobId)).isPresent();

        assertThat(coordinator.submit(jobId, chosen)).isTrue();

        assertThat(awaiting.get(3, TimeUnit.SECONDS).getKeepAudioLanguages()).containsExactly("eng");
        assertThat(coordinator.isPending(jobId)).isFalse();
    }

    @Test
    void timeoutAppliesSmartDefault() {
        String jobId = "job-timeout";
        TrackFilter fallback = TrackFilter.builder().keepAudioLanguages(List.of("hin")).explicit(true).build();

        TrackFilter result = coordinator.awaitSelection(jobId, opts(jobId), fallback, Duration.ofMillis(120));

        assertThat(result).isSameAs(fallback);
        assertThat(coordinator.isPending(jobId)).isFalse();
    }

    @Test
    void cancelUnparksWithNull() throws Exception {
        String jobId = "job-cancel";
        TrackFilter fallback = TrackFilter.builder().explicit(true).build();

        CompletableFuture<TrackFilter> awaiting = CompletableFuture.supplyAsync(() ->
                coordinator.awaitSelection(jobId, opts(jobId), fallback, Duration.ofSeconds(5)));

        waitUntilPending(jobId);
        coordinator.cancel(jobId);

        assertThat(awaiting.get(3, TimeUnit.SECONDS)).isNull();
        assertThat(coordinator.isPending(jobId)).isFalse();
    }

    @Test
    void submitOnUnknownJobIsNoOp() {
        assertThat(coordinator.submit("nope", TrackFilter.builder().build())).isFalse();
        assertThat(coordinator.getOptions("nope")).isEmpty();
        assertThat(coordinator.isPending("nope")).isFalse();
    }

    @Test
    void selectionMapsToExplicitFilter() {
        TrackReviewSelection sel =
                new TrackReviewSelection(List.of("hin", "eng"), List.of("hin"), "hin", false, true);
        TrackFilter f = sel.toTrackFilter();

        assertThat(f.isExplicit()).isTrue();
        assertThat(f.getKeepAudioLanguages()).containsExactly("hin", "eng");
        assertThat(f.getKeepSubtitleLanguages()).containsExactly("hin");
        assertThat(f.getDefaultAudioLanguage()).isEqualTo("hin");
        assertThat(f.isRemoveAllSubtitles()).isFalse();
    }

    @Test
    void emptyAudioKeepsAllAndEmptySubsDropsAll() {
        TrackReviewSelection sel =
                new TrackReviewSelection(List.of(), List.of(), null, false, true);
        TrackFilter f = sel.toTrackFilter();

        assertThat(f.getKeepAudioLanguages()).isNull();      // empty audio choice = keep all audio
        assertThat(f.getKeepSubtitleLanguages()).isEmpty();  // empty subs choice = drop all
        assertThat(f.isRemoveAllSubtitles()).isTrue();
    }

    private void waitUntilPending(String jobId) throws InterruptedException {
        for (int i = 0; i < 100 && !coordinator.isPending(jobId); i++) {
            Thread.sleep(20);
        }
    }
}
