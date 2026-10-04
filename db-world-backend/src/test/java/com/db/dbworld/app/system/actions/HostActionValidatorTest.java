package com.db.dbworld.app.system.actions;

import com.db.dbworld.app.system.actions.HostActionValidator.Validated;
import com.db.dbworld.core.exception.DbWorldException;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Supplier;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class HostActionValidatorTest {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");

    /** 2026-10-04T19:10:00+05:30. */
    private static final Instant NOW = Instant.parse("2026-10-04T13:40:00Z");

    private static final Supplier<String> HOST = () -> "dbworldpi";

    private final HostActionValidator validator = new HostActionValidator(Clock.fixed(NOW, IST), IST);

    private Validated ok(String action, Map<String, ?> args) {
        return validator.validate(action, args, null, HOST);
    }

    private Validated ok(String action, Map<String, ?> args, String confirm) {
        return validator.validate(action, args, confirm, HOST);
    }

    /** Asserts a 400 whose message contains {@code fragment}. */
    private void rejects(String action, Map<String, ?> args, String confirm, String fragment) {
        assertThatThrownBy(() -> validator.validate(action, args, confirm, HOST))
                .isInstanceOf(DbWorldException.class)
                .hasMessageContaining(fragment)
                .extracting(e -> ((DbWorldException) e).getHttpStatus().value())
                .isEqualTo(400);
    }

    private static ZonedDateTime ist(String localDateTime) {
        return java.time.LocalDateTime.parse(localDateTime).atZone(IST);
    }

    // ── Action names and argument shapes ─────────────────────────────────────

    @Nested
    class ActionsAndShapes {

        @Test
        void unknownAction_isRejected() {
            rejects("rm-rf", Map.of(), null, "Unknown action 'rm-rf'");
        }

        @Test
        void missingAction_isRejected() {
            rejects(null, Map.of(), null, "Say which action");
            rejects("  ", Map.of(), null, "Say which action");
        }

        @Test
        void actionNamesAreCaseSensitive_likeTheHost() {
            rejects("Doctor", Map.of(), null, "Unknown action");
        }

        @ParameterizedTest
        @ValueSource(strings = {"doctor", "backup-start", "backup-verify", "cleanup-preview", "power-cancel", "power-status"})
        void argumentlessActions_acceptEmptyOrNullArgs(String action) {
            assertThat(ok(action, Map.of()).args()).isEmpty();
            assertThat(ok(action, null).args()).isEmpty();
        }

        @ParameterizedTest
        @ValueSource(strings = {"doctor", "backup-start", "backup-verify", "cleanup-preview", "power-cancel", "power-status"})
        void argumentlessActions_refuseAnyArgument(String action) {
            rejects(action, Map.of("force", "yes"), null, "takes no arguments");
        }

        @Test
        void unknownArgumentName_isRejected() {
            rejects("service-restart", Map.of("service", "nginx", "signal", "KILL"), null, "has no argument 'signal'");
        }

        @Test
        void numberValue_isRejected() {
            rejects("power-reboot", Map.of("when", 30), "dbworldpi", "must be a string or a list of strings");
        }

        @Test
        void objectValue_isRejected() {
            rejects("service-restart", Map.of("service", Map.of("name", "nginx")), null, "must be a string or a list of strings");
        }

        @Test
        void listWithANonString_isRejected() {
            rejects("cleanup-apply", Map.of("categories", List.of("apt", 3)), null, "must be a string or a list of strings");
        }

        @Test
        void nullValue_isRejected() {
            Map<String, Object> args = new HashMap<>();
            args.put("service", null);
            rejects("service-restart", args, null, "must be a string or a list of strings");
        }

        @Test
        void controlCharactersInAnEchoedName_areNeutralised() {
            assertThat(HostActionValidator.quote("a\nb\u0007c")).isEqualTo("'a?b?c'");
            assertThat(HostActionValidator.quote("x".repeat(200))).hasSize(82).endsWith("...'");
        }
    }

    // ── service-restart ──────────────────────────────────────────────────────

    @Nested
    class ServiceRestart {

        @ParameterizedTest
        @ValueSource(strings = {"nginx", "redis-server", "aria2", "smbd"})
        void allowedServices_pass(String service) {
            assertThat(ok("service-restart", Map.of("service", service)).args()).containsEntry("service", service);
        }

        @ParameterizedTest
        @ValueSource(strings = {"mysql", "ssh", "NGINX", "nginx.service", "redis"})
        void anyOtherService_isRejected(String service) {
            rejects("service-restart", Map.of("service", service), null, "can be restarted");
        }

        @Test
        void missingService_isRejected() {
            rejects("service-restart", Map.of(), null, "which service");
        }

        @Test
        void serviceAsList_isRejected() {
            rejects("service-restart", Map.of("service", List.of("nginx")), null, "must be a string");
        }
    }

    // ── cleanup-apply ────────────────────────────────────────────────────────

    @Nested
    class CleanupApply {

        @Test
        void categoriesAndTemp_pass_andBothListsAreAlwaysWritten() {
            Validated v = ok("cleanup-apply", Map.of("categories", List.of("journal", "apt", "journal")));
            assertThat(v.args()).containsEntry("categories", List.of("journal", "apt"))
                    .containsEntry("temp", List.of());

            Validated t = ok("cleanup-apply", Map.of("temp", List.of("2228-Heroes", " 2301-Dune ")));
            assertThat(t.args()).containsEntry("categories", List.of())
                    .containsEntry("temp", List.of("2228-Heroes", "2301-Dune"));
        }

        @ParameterizedTest
        @ValueSource(strings = {"journal", "apt", "logs", "runner", "snap", "artefacts"})
        void everyAllowedCategory_passes(String category) {
            assertThat(ok("cleanup-apply", Map.of("categories", List.of(category))).args())
                    .containsEntry("categories", List.of(category));
        }

        @Test
        void nothingPicked_isRejected() {
            rejects("cleanup-apply", Map.of(), null, "at least one");
            rejects("cleanup-apply", Map.of("categories", List.of(), "temp", List.of()), null, "at least one");
        }

        @ParameterizedTest
        @ValueSource(strings = {"temp", "everything", "Journal", "/var/log"})
        void unknownCategory_isRejected(String category) {
            rejects("cleanup-apply", Map.of("categories", List.of(category)), null, "Unknown cleanup category");
        }

        @Test
        void categoriesAsAString_isRejected() {
            rejects("cleanup-apply", Map.of("categories", "journal"), null, "must be a list");
        }

        @ParameterizedTest
        @ValueSource(strings = {"../etc", "a/b", "/", "..", "a..b", "x/../y"})
        void tempNameWithSlashOrDotDot_isRejected(String name) {
            rejects("cleanup-apply", Map.of("temp", List.of(name)), null, "must not contain '/' or '..'");
        }

        @Test
        void tempNameEmptyOrDot_isRejected() {
            rejects("cleanup-apply", Map.of("temp", List.of("")), null, "empty folder name");
            rejects("cleanup-apply", Map.of("temp", List.of("  ")), null, "empty folder name");
            rejects("cleanup-apply", Map.of("temp", List.of(".")), null, "empty folder name");
        }

        @Test
        void tempNameLength_isCappedAt255() {
            assertThat(ok("cleanup-apply", Map.of("temp", List.of("a".repeat(255)))).args()).isNotEmpty();
            rejects("cleanup-apply", Map.of("temp", List.of("a".repeat(256))), null, "longer than 255");
        }

        @Test
        void tempNameWithAControlCharacter_isRejected() {
            rejects("cleanup-apply", Map.of("temp", List.of("evil\nname")), null, "control characters");
        }
    }

    // ── power-reboot ─────────────────────────────────────────────────────────

    @Nested
    class Reboot {

        @Test
        void now_isImmediate() {
            Validated v = ok("power-reboot", Map.of("when", "now"), "dbworldpi");
            assertThat(v.args()).containsEntry("when", "now");
            assertThat(v.confirm()).isEqualTo("dbworldpi");
            assertThat(v.plan().immediate()).isTrue();
            assertThat(v.plan().at()).isEqualTo(ist("2026-10-04T19:10:00"));
        }

        @Test
        void inMinutes_withinOneToFourteenForty() {
            assertThat(ok("power-reboot", Map.of("when", "+1"), "dbworldpi").plan().at()).isEqualTo(ist("2026-10-04T19:11:00"));
            assertThat(ok("power-reboot", Map.of("when", "+1440"), "dbworldpi").plan().at()).isEqualTo(ist("2026-10-05T19:10:00"));
            rejects("power-reboot", Map.of("when", "+0"), "dbworldpi", "between 1 and 1440");
            rejects("power-reboot", Map.of("when", "+1441"), "dbworldpi", "between 1 and 1440");
            rejects("power-reboot", Map.of("when", "+9999999"), "dbworldpi", "must be now, +N");
        }

        @Test
        void clockTime_laterToday_staysToday() {
            Validated v = ok("power-reboot", Map.of("when", "23:00"), "dbworldpi");
            assertThat(v.plan().at()).isEqualTo(ist("2026-10-04T23:00:00"));
            assertThat(v.plan().immediate()).isFalse();
        }

        @Test
        void clockTime_alreadyPassedOrThisMinute_meansTomorrow() {
            assertThat(ok("power-reboot", Map.of("when", "04:30"), "dbworldpi").plan().at()).isEqualTo(ist("2026-10-05T04:30:00"));
            assertThat(ok("power-reboot", Map.of("when", "19:10"), "dbworldpi").plan().at()).isEqualTo(ist("2026-10-05T19:10:00"));
            assertThat(ok("power-reboot", Map.of("when", "19:11"), "dbworldpi").plan().at()).isEqualTo(ist("2026-10-04T19:11:00"));
        }

        @ParameterizedTest
        @ValueSource(strings = {"4:30", "24:00", "12:60", "soon", "NOW", "+", "-5", "04:30:00", "+ 5"})
        void badWhen_isRejected(String when) {
            rejects("power-reboot", Map.of("when", when), "dbworldpi", "'when'");
        }

        @Test
        void missingWhen_isRejected() {
            rejects("power-reboot", Map.of(), "dbworldpi", "Say when to reboot");
        }

        @Test
        void confirmMustEqualTheHostName() {
            rejects("power-reboot", Map.of("when", "now"), "dbworld", "Type the host name 'dbworldpi'");
            rejects("power-reboot", Map.of("when", "now"), "DBWORLDPI", "Type the host name");
            rejects("power-reboot", Map.of("when", "now"), null, "Type the host name");
            // Stray whitespace from a phone keyboard is not a different name.
            assertThat(ok("power-reboot", Map.of("when", "now"), "  dbworldpi ").confirm()).isEqualTo("dbworldpi");
        }

        @Test
        void unknownHost_refusesWith409() {
            assertThatThrownBy(() -> validator.validate("power-reboot", Map.of("when", "now"), "dbworldpi", () -> null))
                    .isInstanceOf(DbWorldException.class)
                    .hasMessageContaining("host name is not known")
                    .extracting(e -> ((DbWorldException) e).getHttpStatus().value())
                    .isEqualTo(409);
        }

        @Test
        void hostName_isOnlyLookedUpForRebootAndShutdown() {
            AtomicInteger lookups = new AtomicInteger();
            Supplier<String> counting = () -> { lookups.incrementAndGet(); return "dbworldpi"; };
            validator.validate("doctor", Map.of(), null, counting);
            validator.validate("power-cancel", Map.of(), null, counting);
            validator.validate("service-restart", Map.of("service", "nginx"), null, counting);
            assertThat(lookups).hasValue(0);
            validator.validate("power-reboot", Map.of("when", "now"), "dbworldpi", counting);
            assertThat(lookups).hasValue(1);
        }
    }

    // ── power-shutdown ───────────────────────────────────────────────────────

    @Nested
    class Shutdown {

        @Test
        void withWakeInMinutes_passes() {
            Validated v = ok("power-shutdown", Map.of("when", "now", "wake", "+600"), "dbworldpi");
            assertThat(v.args()).containsEntry("when", "now").containsEntry("wake", "+600");
            assertThat(v.plan().wakeAt()).isEqualTo(ist("2026-10-05T05:10:00"));
        }

        @Test
        void withWakeAtALocalDateTime_passes() {
            Validated v = ok("power-shutdown", Map.of("when", "23:00", "wake", "2026-10-05T06:00"), "dbworldpi");
            assertThat(v.plan().at()).isEqualTo(ist("2026-10-04T23:00:00"));
            assertThat(v.plan().wakeAt()).isEqualTo(ist("2026-10-05T06:00:00"));
        }

        @Test
        void withoutAWakeTime_isRefused() {
            rejects("power-shutdown", Map.of("when", "now"), "dbworldpi", "needs a wake time");
            rejects("power-shutdown", Map.of("when", "now", "wake", " "), "dbworldpi", "needs a wake time");
        }

        @Test
        void wakeInMinutes_withinFiveToTenThousandEighty() {
            assertThat(ok("power-shutdown", Map.of("when", "now", "wake", "+10080"), "dbworldpi").plan().wakeAt())
                    .isEqualTo(ist("2026-10-11T19:10:00"));
            rejects("power-shutdown", Map.of("when", "now", "wake", "+4"), "dbworldpi", "between 5 and 10080");
            rejects("power-shutdown", Map.of("when", "now", "wake", "+10081"), "dbworldpi", "between 5 and 10080");
        }

        @Test
        void wake_mustBeAtLeastFiveMinutesAfterTheShutdown() {
            // Exactly five minutes is enough.
            assertThat(ok("power-shutdown", Map.of("when", "now", "wake", "+5"), "dbworldpi")).isNotNull();
            assertThat(ok("power-shutdown", Map.of("when", "23:00", "wake", "2026-10-04T23:05"), "dbworldpi")).isNotNull();

            rejects("power-shutdown", Map.of("when", "+1", "wake", "+5"), "dbworldpi", "at least 5 minutes after the shutdown");
            rejects("power-shutdown", Map.of("when", "23:00", "wake", "2026-10-04T23:04"), "dbworldpi", "at least 5 minutes after");
            rejects("power-shutdown", Map.of("when", "+120", "wake", "+60"), "dbworldpi", "at least 5 minutes after");
        }

        @Test
        void wakeInThePast_isRejected() {
            rejects("power-shutdown", Map.of("when", "now", "wake", "2026-10-04T06:00"), "dbworldpi", "at least 5 minutes after");
        }

        @Test
        void wakeAsADate_isCappedAtAWeek_likeMinutes() {
            // NOW is 2026-10-04T19:10 IST, so exactly a week is 2026-10-11T19:10.
            assertThat(ok("power-shutdown", Map.of("when", "now", "wake", "2026-10-11T19:10"), "dbworldpi").plan().wakeAt())
                    .isEqualTo(ist("2026-10-11T19:10:00"));
            rejects("power-shutdown", Map.of("when", "now", "wake", "2026-10-11T19:11"), "dbworldpi", "within a week");
            rejects("power-shutdown", Map.of("when", "now", "wake", "2027-01-01T06:00"), "dbworldpi", "within a week");
        }

        @ParameterizedTest
        @ValueSource(strings = {"2026-02-30T06:00", "2026-10-05T24:00", "2026-13-01T06:00"})
        void wakeThatIsNotARealDate_isRejected(String wake) {
            rejects("power-shutdown", Map.of("when", "now", "wake", wake), "dbworldpi", "not a real date");
        }

        @ParameterizedTest
        @ValueSource(strings = {"06:00", "tomorrow", "2026-10-05 06:00", "2026-10-05T06:00:00", "2026-10-05T06:00+05:30", "now"})
        void wakeInAnyOtherForm_isRejected(String wake) {
            rejects("power-shutdown", Map.of("when", "now", "wake", wake), "dbworldpi", "'wake' must be +N");
        }

        @Test
        void confirmMustEqualTheHostName() {
            rejects("power-shutdown", Map.of("when", "now", "wake", "+60"), "pi", "Type the host name");
        }
    }

    // ── Wording ──────────────────────────────────────────────────────────────

    @Test
    void describe_namesTheDayOnlyWhenItIsNotToday() {
        ZonedDateTime now = ist("2026-10-04T19:10:00");
        assertThat(HostActionValidator.describe(ist("2026-10-04T23:00:00"), now)).isEqualTo("23:00");
        assertThat(HostActionValidator.describe(ist("2026-10-05T06:00:00"), now)).isEqualTo("06:00 tomorrow");
        assertThat(HostActionValidator.describe(ist("2026-10-06T06:00:00"), now)).isEqualTo("Tue 6 Oct 06:00");
    }
}
