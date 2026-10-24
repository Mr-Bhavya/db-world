package com.db.dbworld.app.system.actions;

import com.db.dbworld.app.system.actions.dto.HostActionResult;
import com.db.dbworld.app.system.actions.dto.HostActionSubmitted;
import com.db.dbworld.app.system.actions.dto.HostActionsList;
import com.db.dbworld.app.system.actions.dto.HostPowerState;
import com.db.dbworld.app.system.health.HostHealthService;
import com.db.dbworld.app.system.health.alert.HostHealthMonitor;
import com.db.dbworld.app.system.health.dto.HostHealthReport;
import com.db.dbworld.app.system.health.dto.HostHealthReport.Counts;
import com.db.dbworld.core.exception.DbWorldException;
import com.db.dbworld.core.push.PushService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.FileTime;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class HostActionsServiceTest {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");

    /** 2026-10-04T19:10:00+05:30. */
    private static final Instant NOW = Instant.parse("2026-10-04T13:40:00Z");

    private static final String ADMIN = "admin@example.com";
    private static final ObjectMapper JSON = new ObjectMapper();

    @Mock HostHealthService healthService;
    @Mock PushService pushService;

    @TempDir Path dir;
    private Path requests;
    private Path results;
    private HostActionsService service;

    @BeforeEach
    void setUp() throws IOException {
        requests = Files.createDirectories(dir.resolve("requests"));
        results = Files.createDirectories(dir.resolve("results"));
        when(healthService.read()).thenReturn(healthFrom("dbworldpi"));
        service = new HostActionsService(dir, IST, Clock.fixed(NOW, IST), healthService, pushService);
    }

    private static HostHealthReport healthFrom(String host) {
        return new HostHealthReport(true, null, false, 60L, "/var/lib/dbworld/health/doctor.json",
                1, host, "2026-10-04T19:00:00+05:30", 1_791_120_600L, 900L, "ok", Counts.ZERO, List.of());
    }

    private List<Path> requestFiles() throws IOException {
        try (Stream<Path> files = Files.list(requests)) {
            return files.toList();
        }
    }

    private static JsonNode read(Path file) throws IOException {
        return JSON.readTree(Files.readString(file, StandardCharsets.UTF_8));
    }

    private static String id(int n) {
        return String.format("00000000-0000-4000-8000-%012d", n);
    }

    private void writeResult(String id, String json) throws IOException {
        Files.writeString(results.resolve(id + ".json"), json, StandardCharsets.UTF_8);
    }

    private void writeQueued(String id, String action, String requestedAt) throws IOException {
        Files.writeString(requests.resolve(id + ".json"), """
                {"version":1,"id":"%s","action":"%s","args":{},"confirm":"",
                 "requestedBy":"other@example.com","requestedAt":"%s"}
                """.formatted(id, action, requestedAt), StandardCharsets.UTF_8);
    }

    private static String result(String id, String action, String status, String requestedAt) {
        return """
                {"version":1,"id":"%s","action":"%s","args":{},"requestedBy":"%s","requestedAt":"%s",
                 "status":"%s","message":"Finished","startedAt":"%s","finishedAt":null,"exitCode":0,
                 "output":"line one\\nline two","data":null}
                """.formatted(id, action, ADMIN, requestedAt, status, requestedAt);
    }

    // ── Submitting ───────────────────────────────────────────────────────────

    @Nested
    class Submit {

        @Test
        void writesOneValidRequestNamedAfterItsId_andNoTempFile() throws IOException {
            HostActionSubmitted submitted = service.submit("power-reboot", Map.of("when", "+30"), "dbworldpi", ADMIN);

            assertThat(submitted.status()).isEqualTo("queued");
            assertThat(submitted.id()).matches("[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}");
            assertThat(UUID.fromString(submitted.id()).version()).isEqualTo(4);

            List<Path> files = requestFiles();
            assertThat(files).extracting(p -> p.getFileName().toString())
                    .containsExactly(submitted.id() + ".json");
            assertThat(files.getFirst().getFileName().toString()).matches("^[0-9a-f-]{36}\\.json$");

            JsonNode request = read(files.getFirst());
            assertThat(request.get("version").asInt()).isEqualTo(1);
            assertThat(request.get("id").asString()).isEqualTo(submitted.id());
            assertThat(request.get("action").asString()).isEqualTo("power-reboot");
            assertThat(request.get("args").get("when").asString()).isEqualTo("+30");
            assertThat(request.get("confirm").asString()).isEqualTo("dbworldpi");
            assertThat(request.get("requestedBy").asString()).isEqualTo(ADMIN);
            assertThat(request.get("requestedAt").asString()).isEqualTo("2026-10-04T19:10:00+05:30");
        }

        @Test
        void listArgumentsAreWrittenAsJsonArrays_andConfirmAsAnEmptyString() throws IOException {
            service.submit("cleanup-apply", Map.of("categories", List.of("journal", "apt"), "temp", List.of("2228-Heroes")),
                    null, ADMIN);

            JsonNode request = read(requestFiles().getFirst());
            JsonNode args = request.get("args");
            assertThat(args.get("categories").isArray()).isTrue();
            assertThat(args.get("categories").values()).extracting(JsonNode::asString).containsExactly("journal", "apt");
            assertThat(args.get("temp").values()).extracting(JsonNode::asString).containsExactly("2228-Heroes");
            assertThat(request.get("confirm").asString()).isEmpty();
        }

        @Test
        void argumentlessAction_writesAnEmptyArgsObject() throws IOException {
            service.submit("doctor", null, null, ADMIN);

            JsonNode args = read(requestFiles().getFirst()).get("args");
            assertThat(args.isObject()).isTrue();
            assertThat(args.size()).isZero();
        }

        @Test
        void invalidRequest_isRefusedWith400_andNothingIsWritten() throws IOException {
            assertThatThrownBy(() -> service.submit("service-restart", Map.of("service", "mysql"), null, ADMIN))
                    .isInstanceOf(DbWorldException.class)
                    .extracting(e -> ((DbWorldException) e).getHttpStatus().value())
                    .isEqualTo(400);
            assertThat(requestFiles()).isEmpty();
        }

        @Test
        void blankRequester_isRecordedAsAdmin() throws IOException {
            service.submit("doctor", Map.of(), null, " ");
            assertThat(read(requestFiles().getFirst()).get("requestedBy").asString()).isEqualTo("admin");
        }

        @Test
        void noBrokerDirectory_refusesWith503() {
            HostActionsService devBox = new HostActionsService(dir.resolve("missing"), IST, Clock.fixed(NOW, IST),
                    healthService, pushService);

            assertThatThrownBy(() -> devBox.submit("doctor", Map.of(), null, ADMIN))
                    .isInstanceOf(DbWorldException.class)
                    .hasMessageContaining("No action broker")
                    .extracting(e -> ((DbWorldException) e).getHttpStatus().value())
                    .isEqualTo(503);
        }
    }

    // ── One power request at a time ──────────────────────────────────────────

    @Nested
    class PowerRateLimit {

        @Test
        void secondPowerAction_whileOneIsQueued_isRefusedWith409() throws IOException {
            writeQueued(id(1), "power-reboot", "2026-10-04T19:09:59+05:30");

            assertThatThrownBy(() -> service.submit("power-cancel", Map.of(), null, ADMIN))
                    .isInstanceOf(DbWorldException.class)
                    .hasMessageContaining("Another power request (power-reboot by other@example.com)")
                    .extracting(e -> ((DbWorldException) e).getHttpStatus().value())
                    .isEqualTo(409);
            assertThat(requestFiles()).hasSize(1);
        }

        @Test
        void secondSubmitOfTheSameReboot_isRefused() {
            service.submit("power-reboot", Map.of("when", "now"), "dbworldpi", ADMIN);

            assertThatThrownBy(() -> service.submit("power-reboot", Map.of("when", "now"), "dbworldpi", ADMIN))
                    .hasMessageContaining("still waiting");
        }

        @Test
        void otherActions_areNotHeldUpByAQueuedPowerRequest() throws IOException {
            writeQueued(id(1), "power-shutdown", "2026-10-04T19:09:59+05:30");

            assertThatCode(() -> service.submit("doctor", Map.of(), null, ADMIN)).doesNotThrowAnyException();
            assertThat(requestFiles()).hasSize(2);
        }

        @Test
        void aQueuedNonPowerRequest_doesNotBlockPower() throws IOException {
            writeQueued(id(1), "backup-start", "2026-10-04T19:09:59+05:30");

            assertThatCode(() -> service.submit("power-reboot", Map.of("when", "now"), "dbworldpi", ADMIN))
                    .doesNotThrowAnyException();
        }

        @Test
        void aFinishedPowerRequest_doesNotBlockTheNextOne() throws IOException {
            writeResult(id(1), result(id(1), "power-reboot", "done", "2026-10-04T19:00:00+05:30"));

            assertThatCode(() -> service.submit("power-cancel", Map.of(), null, ADMIN)).doesNotThrowAnyException();
        }
    }

    // ── Host name for the confirm ────────────────────────────────────────────

    @Nested
    class ConfirmHost {

        @Test
        void comesFromTheHealthReport() {
            assertThat(service.confirmHostName()).isEqualTo("dbworldpi");
        }

        @Test
        void fallsBackToPowerJson_whenTheHealthReportHasNoHost() throws IOException {
            when(healthService.read()).thenReturn(HostHealthReport.unavailable("/x", "No health report"));
            Files.writeString(dir.resolve("power.json"), """
                    {"version":1,"host":"pi-from-power","generatedAt":"2026-10-04T19:00:00+05:30",
                     "scheduled":null,"wakeAlarm":null}
                    """);

            assertThat(service.confirmHostName()).isEqualTo("pi-from-power");
            assertThatCode(() -> service.submit("power-reboot", Map.of("when", "now"), "pi-from-power", ADMIN))
                    .doesNotThrowAnyException();
        }

        @Test
        void unknownEverywhere_refusesPowerActions() {
            when(healthService.read()).thenReturn(HostHealthReport.unavailable("/x", "No health report"));

            assertThat(service.confirmHostName()).isNull();
            assertThatThrownBy(() -> service.submit("power-reboot", Map.of("when", "now"), "dbworldpi", ADMIN))
                    .hasMessageContaining("host name is not known");
            // Non-power actions do not need it.
            assertThatCode(() -> service.submit("doctor", Map.of(), null, ADMIN)).doesNotThrowAnyException();
        }

        @Test
        void aHealthServiceThatThrows_fallsBackQuietly() {
            when(healthService.read()).thenThrow(new IllegalStateException("boom"));
            assertThat(service.confirmHostName()).isNull();
        }
    }

    // ── Push to admins ───────────────────────────────────────────────────────

    @Nested
    class Push {

        @Test
        void rebootNow_isAnnounced() {
            service.submit("power-reboot", Map.of("when", "now"), "dbworldpi", ADMIN);

            verify(pushService).broadcastToAdmins("Server rebooting", "Reboot now, requested by " + ADMIN,
                    HostHealthMonitor.DEEP_LINK, HostHealthMonitor.CHANNEL);
        }

        @Test
        void scheduledReboot_namesTheTime() {
            service.submit("power-reboot", Map.of("when", "04:30"), "dbworldpi", ADMIN);

            verify(pushService).broadcastToAdmins(eq("Server reboot scheduled"),
                    eq("Reboot scheduled for 04:30 tomorrow by " + ADMIN), anyMap(), eq("admin"));
        }

        @Test
        void rebootInMinutes_namesTheResultingTime() {
            service.submit("power-reboot", Map.of("when", "+30"), "dbworldpi", ADMIN);

            verify(pushService).broadcastToAdmins(anyString(), eq("Reboot scheduled for 19:40 by " + ADMIN), anyMap(), anyString());
        }

        @Test
        void shutdown_namesBothTimes() {
            service.submit("power-shutdown", Map.of("when", "23:00", "wake", "2026-10-05T06:00"), "dbworldpi", ADMIN);

            verify(pushService).broadcastToAdmins(eq("Server shutdown scheduled"),
                    eq("Shutdown at 23:00, back on at 06:00 tomorrow, by " + ADMIN), anyMap(), eq("admin"));
        }

        @Test
        void shutdownNow_saysNow() {
            service.submit("power-shutdown", Map.of("when", "now", "wake", "+60"), "dbworldpi", ADMIN);

            verify(pushService).broadcastToAdmins(anyString(), eq("Shutdown now, back on at 20:10, by " + ADMIN), anyMap(), anyString());
        }

        @Test
        void cancel_isAnnounced() {
            service.submit("power-cancel", Map.of(), null, ADMIN);

            verify(pushService).broadcastToAdmins("Power action cancelled", "Scheduled power action cancelled by " + ADMIN,
                    HostHealthMonitor.DEEP_LINK, HostHealthMonitor.CHANNEL);
        }

        @Test
        void otherActions_areNotAnnounced() {
            service.submit("doctor", Map.of(), null, ADMIN);
            service.submit("backup-start", Map.of(), null, ADMIN);
            service.submit("service-restart", Map.of("service", "nginx"), null, ADMIN);
            service.submit("cleanup-preview", Map.of(), null, ADMIN);
            service.submit("power-status", Map.of(), null, ADMIN);

            verify(pushService, never()).broadcastToAdmins(any(), any(), any(), any());
        }

        @Test
        void rejectedSubmit_isNotAnnounced() {
            assertThatThrownBy(() -> service.submit("power-reboot", Map.of("when", "now"), "wrong", ADMIN))
                    .isInstanceOf(DbWorldException.class);

            verify(pushService, never()).broadcastToAdmins(any(), any(), any(), any());
        }

        @Test
        void aFailingPush_doesNotFailTheSubmit() throws IOException {
            doThrow(new RuntimeException("FCM down")).when(pushService)
                    .broadcastToAdmins(anyString(), anyString(), anyMap(), anyString());

            assertThatCode(() -> service.submit("power-cancel", Map.of(), null, ADMIN)).doesNotThrowAnyException();
            assertThat(requestFiles()).hasSize(1);
        }
    }

    // ── Listing ──────────────────────────────────────────────────────────────

    @Nested
    class Listing {

        @Test
        void mergesQueuedRequestsAndResults_newestFirst() throws IOException {
            writeResult(id(1), result(id(1), "doctor", "done", "2026-10-04T18:00:00+05:30"));
            writeResult(id(2), result(id(2), "backup-start", "running", "2026-10-04T19:05:00+05:30"));
            writeQueued(id(3), "service-restart", "2026-10-04T19:09:30+05:30");

            HostActionsList list = service.list();

            assertThat(list.available()).isTrue();
            assertThat(list.reason()).isNull();
            assertThat(list.items()).extracting(HostActionResult::id).containsExactly(id(3), id(2), id(1));
            assertThat(list.items()).extracting(HostActionResult::status).containsExactly("queued", "running", "done");
            assertThat(list.items().getFirst().message()).isEqualTo("Waiting for the host to pick this up.");
        }

        @Test
        void carriesTheConfirmHostAndThePiZone() {
            HostActionsList list = service.list();

            assertThat(list.host()).isEqualTo("dbworldpi");
            assertThat(list.zone()).isEqualTo("Asia/Kolkata");
            assertThat(list.utcOffsetSeconds()).isEqualTo(19_800);
            assertThat(list.dir()).isEqualTo(dir.toString());
        }

        @Test
        void aRequestWithAResult_isShownOnceAsTheResult() throws IOException {
            writeQueued(id(1), "doctor", "2026-10-04T19:09:00+05:30");
            writeResult(id(1), result(id(1), "doctor", "running", "2026-10-04T19:09:00+05:30"));

            assertThat(service.list().items()).singleElement()
                    .satisfies(r -> assertThat(r.status()).isEqualTo("running"));
        }

        @Test
        void leavesOutputAndDataOut_butSaysThereIsOutput() throws IOException {
            writeResult(id(1), result(id(1), "doctor", "done", "2026-10-04T18:00:00+05:30"));

            HostActionResult item = service.list().items().getFirst();
            assertThat(item.output()).isNull();
            assertThat(item.data()).isNull();
            assertThat(item.hasOutput()).isTrue();
        }

        @Test
        void ignoresFilesThatAreNotRequestsOrResults() throws IOException {
            Files.writeString(requests.resolve("." + id(9) + ".tmp"), "{\"action\":\"power-reboot\"}");
            Files.writeString(requests.resolve("notes.txt"), "hello");
            Files.writeString(results.resolve("README.json"), "{}");

            assertThat(service.list().items()).isEmpty();
            // A half-written temp file is not a queued power request either.
            assertThatCode(() -> service.submit("power-cancel", Map.of(), null, ADMIN)).doesNotThrowAnyException();
        }

        @Test
        void anUnreadableResult_isListedAsUnknown_notDropped() throws IOException {
            writeResult(id(1), "this is not json");
            writeResult(id(2), result(id(2), "doctor", "done", "2026-10-04T18:00:00+05:30"));

            HostActionsList list = service.list();

            assertThat(list.items()).hasSize(2);
            assertThat(list.items()).filteredOn(r -> r.id().equals(id(1))).singleElement()
                    .satisfies(r -> {
                        assertThat(r.status()).isEqualTo("unknown");
                        assertThat(r.message()).contains("not a JSON object");
                    });
        }

        @Test
        void keepsTheFiftyMostRecentResults() throws IOException {
            for (int i = 1; i <= 55; i++) {
                writeResult(id(i), result(id(i), "doctor", "done", "2026-10-04T10:00:00+05:30"));
                Files.setLastModifiedTime(results.resolve(id(i) + ".json"), FileTime.from(NOW.minusSeconds(1000 - i)));
            }

            List<HostActionResult> items = service.list().items();

            assertThat(items).hasSize(HostActionsService.MAX_RESULTS);
            assertThat(items).extracting(HostActionResult::id).doesNotContain(id(1), id(5)).contains(id(6), id(55));
        }

        @Test
        void aRequestWaitingTooLong_saysTheBrokerMayBeDown() throws IOException {
            writeQueued(id(1), "doctor", "2026-10-04T19:05:00+05:30");

            assertThat(service.list().items().getFirst().message())
                    .isEqualTo("Not picked up after 5 min. The host's action broker may not be running.");
        }

        @Test
        void noBrokerDirectory_isUnavailable_withTheReason() {
            HostActionsService devBox = new HostActionsService(dir.resolve("missing"), IST, Clock.fixed(NOW, IST),
                    healthService, pushService);

            HostActionsList list = devBox.list();

            assertThat(list.available()).isFalse();
            assertThat(list.reason()).contains("No action broker").contains("missing");
            assertThat(list.items()).isEmpty();
        }

        @Test
        void noRequestsFolder_isUnavailable() throws IOException {
            Files.delete(requests);

            assertThat(service.list().available()).isFalse();
            assertThat(service.list().reason()).contains("no requests/ folder");
        }

        @Test
        void noResultsFolderYet_isAnEmptyList() throws IOException {
            Files.delete(results);

            HostActionsList list = service.list();
            assertThat(list.available()).isTrue();
            assertThat(list.items()).isEmpty();
        }
    }

    // ── One action ───────────────────────────────────────────────────────────

    @Nested
    class GetOne {

        private static final String PREVIEW = """
                {"version":1,"id":"%s","action":"cleanup-preview","args":{},"requestedBy":"admin@example.com",
                 "requestedAt":"2026-10-04T19:00:00+05:30","status":"done","message":"163 GB can be freed",
                 "startedAt":"2026-10-04T19:00:01+05:30","finishedAt":"2026-10-04T19:00:09+05:30","exitCode":0,
                 "output":"  checking journal\\n  checking temp","data":{"categories":[
                   {"id":"temp","label":"Ingestion leftovers","kb":162529280,
                    "items":[{"name":"2228-Heroes","kb":41127504,"lastWritten":"2026-07-06"}],"skipped":""},
                   {"id":"journal","label":"systemd journal","kb":0,"items":[],"skipped":""}],
                  "totalKb":163000000}}
                """;

        @Test
        void returnsTheOutputAndData() throws IOException {
            writeResult(id(1), PREVIEW.formatted(id(1)));

            HostActionResult r = service.get(id(1));

            assertThat(r.status()).isEqualTo("done");
            assertThat(r.finishedAt()).isEqualTo("2026-10-04T19:00:09+05:30");
            assertThat(r.exitCode()).isZero();
            assertThat(r.output()).isEqualTo("  checking journal\n  checking temp");
            assertThat(r.data()).isInstanceOf(Map.class);
            @SuppressWarnings("unchecked")
            Map<String, Object> data = (Map<String, Object>) r.data();
            assertThat(data).containsKey("categories");
            assertThat(((Number) data.get("totalKb")).longValue()).isEqualTo(163_000_000L);
        }

        @Test
        void aQueuedRequest_isFoundAsQueued() throws IOException {
            writeQueued(id(1), "backup-verify", "2026-10-04T19:09:59+05:30");

            assertThat(service.get(id(1)).status()).isEqualTo("queued");
        }

        @Test
        void unknownId_is404() {
            assertThatThrownBy(() -> service.get(id(42)))
                    .isInstanceOf(DbWorldException.class)
                    .extracting(e -> ((DbWorldException) e).getHttpStatus().value())
                    .isEqualTo(404);
        }

        @Test
        void somethingThatIsNotAnId_is400_beforeTouchingTheDisk() {
            for (String bad : List.of("../../etc/passwd", "ABCDEF00-0000-4000-8000-000000000001", "short", "")) {
                assertThatThrownBy(() -> service.get(bad))
                        .isInstanceOf(DbWorldException.class)
                        .extracting(e -> ((DbWorldException) e).getHttpStatus().value())
                        .isEqualTo(400);
            }
        }
    }

    // ── Lenient result parsing ───────────────────────────────────────────────

    @Nested
    class ResultParsing {

        @Test
        void unknownStatus_readsAsUnknown_andCaseIsFolded() {
            assertThat(service.parseResult("{\"status\":\"exploded\"}", id(1), true).status()).isEqualTo("unknown");
            assertThat(service.parseResult("{\"status\":\"DONE\"}", id(1), true).status()).isEqualTo("done");
            assertThat(service.parseResult("{\"status\":\"rejected\"}", id(1), true).status()).isEqualTo("rejected");
        }

        @Test
        void missingFields_getDefaults_andUnknownOnesAreIgnored() {
            HostActionResult r = service.parseResult("{\"status\":\"failed\",\"futureField\":{\"x\":1}}", id(1), true);

            assertThat(r.id()).isEqualTo(id(1));
            assertThat(r.action()).isEmpty();
            assertThat(r.args()).isEmpty();
            assertThat(r.requestedBy()).isNull();
            assertThat(r.requestedAt()).isNull();
            assertThat(r.message()).isNull();
            assertThat(r.exitCode()).isNull();
            assertThat(r.output()).isEmpty();
            assertThat(r.data()).isNull();
            assertThat(r.hasOutput()).isFalse();
        }

        @Test
        void exitCodeAsAString_isRead() {
            assertThat(service.parseResult("{\"exitCode\":\"3\"}", id(1), true).exitCode()).isEqualTo(3);
            assertThat(service.parseResult("{\"exitCode\":\"three\"}", id(1), true).exitCode()).isNull();
        }

        @Test
        void theFileNameIsTheId_whateverTheContentSays() {
            assertThat(service.parseResult("{\"id\":\"something-else\"}", id(7), true).id()).isEqualTo(id(7));
        }

        @Test
        void argsKeepStringsAndLists() {
            HostActionResult r = service.parseResult(
                    "{\"args\":{\"categories\":[\"apt\",\"logs\"],\"when\":\"+30\",\"n\":5}}", id(1), true);

            assertThat(r.args()).containsEntry("categories", List.of("apt", "logs"))
                    .containsEntry("when", "+30")
                    .containsEntry("n", "5");
        }

        @Test
        void nonObjectContent_isUnreadable() {
            assertThat(service.parseResult("[1,2]", id(1), true).status()).isEqualTo("unknown");
            assertThat(service.parseResult("", id(1), true).message()).contains("not a JSON object");
        }

        @Test
        void aQueuedRequestThatCannotBeParsed_isStillListedById() {
            HostActionResult r = service.parseQueued("{broken", id(1), NOW);

            assertThat(r.id()).isEqualTo(id(1));
            assertThat(r.status()).isEqualTo("queued");
            assertThat(r.action()).isEmpty();
        }
    }

    // ── power.json ───────────────────────────────────────────────────────────

    @Nested
    class Power {

        private Path powerFile() {
            return dir.resolve("power.json");
        }

        @Test
        void scheduledShutdownWithWakeAlarm_isParsed() throws IOException {
            Files.writeString(powerFile(), """
                    {"version":1,"host":"dbworldpi","generatedAt":"2026-10-04T19:00:00+05:30",
                     "scheduled":{"mode":"poweroff","at":"2026-10-04T23:00:00+05:30","atEpoch":1791135000},
                     "wakeAlarm":{"at":"2026-10-05T06:00:00+05:30","atEpoch":1791160200}}
                    """);

            HostPowerState p = service.power();

            assertThat(p.available()).isTrue();
            assertThat(p.host()).isEqualTo("dbworldpi");
            assertThat(p.generatedAt()).isEqualTo("2026-10-04T19:00:00+05:30");
            assertThat(p.ageSeconds()).isEqualTo(600L);
            assertThat(p.scheduled().mode()).isEqualTo("poweroff");
            assertThat(p.scheduled().atEpoch()).isEqualTo(1_791_135_000L);
            assertThat(p.wakeAlarm().at()).isEqualTo("2026-10-05T06:00:00+05:30");
            assertThat(p.wakeAlarm().atEpoch()).isEqualTo(1_791_160_200L);
        }

        @Test
        void nothingScheduled_isNulls() throws IOException {
            Files.writeString(powerFile(), """
                    {"version":1,"host":"dbworldpi","generatedAt":"2026-10-04T19:00:00+05:30","scheduled":null,"wakeAlarm":null}
                    """);

            HostPowerState p = service.power();
            assertThat(p.available()).isTrue();
            assertThat(p.scheduled()).isNull();
            assertThat(p.wakeAlarm()).isNull();
        }

        @Test
        void lenient_epochFromIsoOrString_modeLowerCased_emptyObjectsAreNothing() {
            HostPowerState p = service.parsePower("""
                    {"scheduled":{"mode":"REBOOT","at":"2026-10-04T23:00:00+05:30"},
                     "wakeAlarm":{"atEpoch":"1791160200"},"extra":[1,2,3]}
                    """, NOW);

            assertThat(p.scheduled().mode()).isEqualTo("reboot");
            assertThat(p.scheduled().atEpoch()).isEqualTo(1_791_135_000L);
            assertThat(p.wakeAlarm().atEpoch()).isEqualTo(1_791_160_200L);
            assertThat(p.wakeAlarm().at()).isNull();
            assertThat(p.host()).isNull();
            // No generatedAt: aged by the file's own time.
            assertThat(p.ageSeconds()).isZero();

            HostPowerState empty = service.parsePower("{\"scheduled\":{},\"wakeAlarm\":\"soon\"}", NOW);
            assertThat(empty.scheduled()).isNull();
            assertThat(empty.wakeAlarm()).isNull();
        }

        @Test
        void missingFile_isUnavailable() {
            HostPowerState p = service.power();

            assertThat(p.available()).isFalse();
            assertThat(p.reason()).contains("No power state");
        }

        @Test
        void garbage_isUnavailable_notAnError() throws IOException {
            Files.writeString(powerFile(), "<html>nope</html>");

            assertThat(service.power().available()).isFalse();
            assertThat(service.power().reason()).contains("not a JSON object");
        }

        @Test
        void noBrokerDirectory_isUnavailable() {
            HostActionsService devBox = new HostActionsService(dir.resolve("missing"), IST, Clock.fixed(NOW, IST),
                    healthService, pushService);

            assertThat(devBox.power().available()).isFalse();
            assertThat(devBox.power().reason()).contains("No action broker");
        }
    }

    @Test
    void humanDuration_isCoarse() {
        assertThat(HostActionsService.humanDuration(42)).isEqualTo("42 s");
        assertThat(HostActionsService.humanDuration(300)).isEqualTo("5 min");
        assertThat(HostActionsService.humanDuration(3 * 3600)).isEqualTo("3 h");
        assertThat(HostActionsService.humanDuration(72 * 3600)).isEqualTo("3 days");
    }
}
