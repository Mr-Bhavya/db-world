package com.db.dbworld.app.downloader;

import com.db.dbworld.config.AppProperties;
import com.db.dbworld.infrastructure.storage.MediaDiskGuard;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;
import java.nio.file.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class MediaDownloaderServiceTest {
    @TempDir Path temp;
    DownloadJobRepository repository;
    MediaDiskGuard disk;
    MediaDownloaderService service;

    @BeforeEach void setup() {
        repository = mock(DownloadJobRepository.class);
        disk = mock(MediaDiskGuard.class);
        AppProperties properties = mock(AppProperties.class);
        when(properties.getDownloadsPath()).thenReturn(temp);
        when(disk.isMounted()).thenReturn(true);
        service = new MediaDownloaderService(repository, properties, disk, new ObjectMapper(), "");
    }

    DownloadJob job(String id, String owner, String status) {
        DownloadJob job = new DownloadJob();
        job.setId(id);
        job.setOwner(owner);
        job.setStatus(status);
        job.setCreatedAt(Instant.now());
        when(repository.findById(id)).thenReturn(Optional.of(job));
        return job;
    }

    @Test void ownerCannotReadOrMutateAnotherUsersJob() {
        job("first", "alice", "READY");
        assertThrows(ResponseStatusException.class, () -> service.authorized("first", "bob", false));
        assertThrows(ResponseStatusException.class, () -> service.cancel("first", "bob", false));
        assertThrows(ResponseStatusException.class, () -> service.delete("first", "bob", false));
        assertEquals("alice", service.authorized("first", "admin", true).getOwner());
    }

    @Test void queuePositionIsPerUser() {
        DownloadJob aliceFirst = job("1", "alice", "QUEUED");
        DownloadJob bobFirst = job("2", "bob", "QUEUED");
        DownloadJob aliceSecond = job("3", "alice", "QUEUED");
        when(repository.findAllByOrderByCreatedAtDesc()).thenReturn(List.of(aliceSecond, bobFirst, aliceFirst));
        var jobs = service.list("admin", true);
        assertEquals(List.of(2, 1, 1), jobs.stream().map(MediaDownloaderService.JobView::queuePosition).toList());
    }

    @Test void schedulerStartsOneJobPerOwnerAndDifferentOwnersCanRunTogether() throws Exception {
        DownloadJob first = job("1", "alice", "QUEUED");
        DownloadJob second = job("2", "alice", "QUEUED");
        DownloadJob other = job("3", "bob", "QUEUED");
        CountDownLatch started = new CountDownLatch(2);
        CountDownLatch release = new CountDownLatch(1);
        doAnswer(call -> { started.countDown(); release.await(5, TimeUnit.SECONDS); throw new IllegalStateException("test stop"); })
                .when(disk).requireMounted("Media preparation");
        when(repository.findByStatusInOrderByCreatedAtAsc(List.of("QUEUED"))).thenReturn(List.of(first, second, other));
        try {
            service.dispatch();
            assertTrue(started.await(3, TimeUnit.SECONDS));
            assertEquals("DOWNLOADING", first.getStatus());
            assertEquals("QUEUED", second.getStatus());
            assertEquals("DOWNLOADING", other.getStatus());
            service.dispatch();
            assertEquals("QUEUED", second.getStatus());
        } finally { service.shutdown(); release.countDown(); }
    }

    @Test void expiryRemovesOnlyTheExpiredJobsFilesAndRetainsHistory() throws Exception {
        DownloadJob expired = job("expired", "alice", "READY");
        expired.setExpiresAt(Instant.now().minusSeconds(1));
        String owner = UUID.nameUUIDFromBytes("alice".getBytes(java.nio.charset.StandardCharsets.UTF_8)).toString();
        Path directory = temp.resolve("media-downloader").resolve(owner).resolve("expired/output");
        Files.createDirectories(directory);
        Files.writeString(directory.resolve("video.mp4"), "file");
        Path unrelated = Files.writeString(temp.resolve("cinema.mp4"), "keep");
        when(repository.findByExpiresAtBeforeAndStatus(any(), eq("READY"))).thenReturn(List.of(expired));
        assertEquals(1, service.cleanup());
        assertFalse(Files.exists(directory));
        assertTrue(Files.exists(unrelated));
        assertEquals("EXPIRED", expired.getStatus());
        verify(repository).save(expired);
    }

    @Test void distinguishesFailureReasonsAndDoesNotExposeRawSecrets() {
        assertTrue(MediaDownloaderService.failureReason("DRM protected").contains("DRM"));
        assertTrue(MediaDownloaderService.failureReason("HTTP Error 429").contains("rate-limiting"));
        assertFalse(MediaDownloaderService.failureReason("secret-cookie-file=/private/token").contains("/private/token"));
        assertTrue(MediaDownloaderService.failureReason("No supported JavaScript runtime").contains("JavaScript runtime"));
        assertTrue(MediaDownloaderService.failureReason("Sign in to confirm you're not a bot").contains("verification"));
    }

    @Test
    @Timeout(15)
    void hardProbeDeadlineStopsEvenAProcessThatKeepsProducingOutput() {
        long start = System.nanoTime();
        var exception = assertThrows(java.net.SocketTimeoutException.class,
                () -> service.runProbeCommand(probeCommand("noisy"), Duration.ofMillis(1200)));
        assertTrue(exception.getMessage().contains("Inspection exceeded"));
        assertTrue(Duration.ofNanos(System.nanoTime() - start).toSeconds() < 12);
    }

    @Test
    @Timeout(15)
    void successfulProbeReturnsItsJson() throws Exception {
        assertEquals("{\"title\":\"probe\"}", service.runProbeCommand(probeCommand("success"), Duration.ofSeconds(10)));
    }

    @Test void inspectionTimeoutUsesTheDomain504Response() throws Exception {
        var downloader = mock(MediaDownloaderService.class);
        when(downloader.inspect("https://example.com", false)).thenThrow(new java.net.SocketTimeoutException("Inspection exceeded 75 seconds."));
        var controller = new MediaDownloaderController(downloader);
        var exception = assertThrows(com.db.dbworld.core.exception.DbWorldException.class,
                () -> controller.inspect(new MediaDownloaderController.InspectRequest("https://example.com", false)));
        assertEquals(org.springframework.http.HttpStatus.GATEWAY_TIMEOUT, exception.getHttpStatus());
        assertTrue(exception.getMessage().contains("75 seconds"));
    }

    private List<String> probeCommand(String mode) throws Exception {
        return List.of(Path.of(System.getProperty("java.home"), "bin", "java").toString(), "-cp",
                Path.of(ProbeFixture.class.getProtectionDomain().getCodeSource().getLocation().toURI()).toString(), ProbeFixture.class.getName(), mode);
    }

    public static class ProbeFixture {
        public static void main(String[] args) throws Exception {
            if (args[0].equals("success")) {
                System.out.println("{\"title\":\"probe\"}");
                return;
            }
            while (true) {
                System.err.println("Retrying source");
                Thread.sleep(40);
            }
        }
    }

    @Test void rejectsInvalidClipRanges() {
        var request = new MediaDownloaderService.Request(List.of("https://example.com"), "best", null, false, false, null, null, 30.0, 10.0);
        assertThrows(ResponseStatusException.class, () -> MediaDownloaderService.validateRequest(request));
    }

    @Test void parsesOnlySafeSeparateTracksAndKeepsQualityMetadata() throws Exception {
        var metadata = new ObjectMapper().readTree("""
                {"formats":[
                  {"format_id":"401","vcodec":"av01.0","acodec":"none","height":4320,"fps":60,"ext":"mp4","filesize":1234,"dynamic_range":"HDR10"},
                  {"format_id":"251","vcodec":"none","acodec":"opus","abr":128,"audio_channels":2,"ext":"webm","filesize_approx":100},
                  {"format_id":"combined","vcodec":"avc1","acodec":"mp4a"},
                  {"format_id":"unsafe/expression","vcodec":"avc1","acodec":"none"},
                  {"format_id":"drm","vcodec":"avc1","acodec":"none","has_drm":true}
                ]}
                """);
        var video = MediaDownloaderService.tracks(metadata, true);
        var audio = MediaDownloaderService.tracks(metadata, false);
        assertEquals(1, video.size());
        assertEquals(4320, video.getFirst().height());
        assertEquals("HDR10", video.getFirst().dynamicRange());
        assertEquals(1, audio.size());
        assertTrue(audio.getFirst().estimated());
        var preview = new MediaDownloaderService.Preview("Title", null, "YouTube", 60.0, List.of(4320), List.of(), List.of(), List.of(), video, audio);
        assertDoesNotThrow(() -> MediaDownloaderService.validateTracks(preview, "401", "251", "webm"));
        assertThrows(ResponseStatusException.class, () -> MediaDownloaderService.validateTracks(preview, "401", "251", "mp4"));
        assertThrows(ResponseStatusException.class, () -> MediaDownloaderService.validateTracks(preview, "missing", null, "auto"));
    }

    @Test void rejectsExactIdsAcrossPlaylistItems() {
        var request = new MediaDownloaderService.Request(List.of("https://example.com/1", "https://example.com/2"), "best", null,
                false, false, null, null, null, null, "401", "251", "mkv");
        assertThrows(ResponseStatusException.class, () -> MediaDownloaderService.validateRequest(request));
    }

    @Test void ticketsAreFileScopedAndCannotOutliveTheFile() throws Exception {
        DownloadJob ready = job("ready", "alice", "READY");
        ready.setFileName("video.mp4");
        ready.setExpiresAt(Instant.now().plusSeconds(120));
        String owner = UUID.nameUUIDFromBytes("alice".getBytes(java.nio.charset.StandardCharsets.UTF_8)).toString();
        Path directory = temp.resolve("media-downloader").resolve(owner).resolve("ready/output");
        Files.createDirectories(directory);
        Files.writeString(directory.resolve("video.mp4"), "file");
        assertThrows(ResponseStatusException.class, () -> service.ticket("bob", List.of("ready"), null, false));
        assertThrows(ResponseStatusException.class, () -> service.ticket("alice", List.of("ready"), "../../other.mp4", false));
        String url = service.ticket("alice", List.of("ready"), null, true);
        var ticket = service.redeem(url.substring(url.lastIndexOf('/') + 1));
        assertEquals("alice", ticket.owner());
        assertEquals(List.of("ready"), ticket.ids());
        assertEquals(ready.getExpiresAt(), ticket.expiresAt());
        assertThrows(ResponseStatusException.class, () -> service.redeem("not-a-ticket"));
    }
}