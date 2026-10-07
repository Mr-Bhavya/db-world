package com.db.dbworld.app.system.info;

import com.db.dbworld.app.system.info.collector.UnsupportedOSCollector;
import com.db.dbworld.app.system.info.collector.linux.LinuxServerInfoCollector;
import com.db.dbworld.app.system.info.collector.linux.RaspberryPiServerInfoCollector;
import com.db.dbworld.app.system.info.collector.windows.WindowsServerInfoCollector;
import com.db.dbworld.app.system.info.dto.BaseServerInfo;
import com.db.dbworld.app.system.info.dto.os.raspberrypi.RaspberryPiServerInfo;
import com.db.dbworld.app.system.info.snapshot.HostInfoSnapshot;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Collector selection and the {@code hostSnapshotAt} stamp with the backend in a container.
 *
 * <p>Which collector the live checks pick depends on the machine the tests run on (a dev PC, a CI
 * runner, the Pi itself), so the fallback cases assert "same choice as host mode" rather than a
 * particular collector. Each mocked collector marks its result so the choice is observable.
 */
class ServerInfoServiceSnapshotTest {

    private static final long GENERATED = 1_791_400_000L;
    private static final Clock CLOCK = Clock.fixed(Instant.ofEpochSecond(GENERATED + 30), ZoneOffset.UTC);

    @TempDir Path run;
    private Path snapshotFile;

    private final WindowsServerInfoCollector windows = mock(WindowsServerInfoCollector.class);
    private final RaspberryPiServerInfoCollector pi = mock(RaspberryPiServerInfoCollector.class);
    private final LinuxServerInfoCollector linux = mock(LinuxServerInfoCollector.class);
    private final UnsupportedOSCollector unsupported = mock(UnsupportedOSCollector.class);

    @BeforeEach
    void setUp() {
        snapshotFile = run.resolve("host-info.json");
        when(windows.collect()).thenReturn(BaseServerInfo.builder().error("windows").build());
        when(pi.collect()).thenReturn(RaspberryPiServerInfo.builder().error("pi").build());
        when(linux.collect()).thenReturn(BaseServerInfo.builder().error("linux").build());
        when(unsupported.collect()).thenReturn(BaseServerInfo.builder().error("unsupported").build());
    }

    private void writeSnapshot(String model) throws IOException {
        Files.writeString(snapshotFile, """
                {"version": 1, "host": "dbworldpi", "generatedAtEpoch": %d, "intervalSeconds": 60,
                 "commands": [], "files": {"/proc/device-tree/model": "%s"}}
                """.formatted(GENERATED, model));
    }

    private ServerInfoService service(HostInfoSnapshot snapshot) {
        return new ServerInfoService(windows, pi, linux, unsupported, snapshot);
    }

    /** Which mocked collector the service chose, read off the marker its result carries. */
    private static String chosen(ServerInfoService service) {
        return service.getSystemInfo().getError();
    }

    private String hostModeChoice() {
        return chosen(service(HostInfoSnapshot.disabled()));
    }

    @Test
    void theSnapshotsModelPicksThePiCollectorInAContainer() throws IOException {
        writeSnapshot("Raspberry Pi 5 Model B Rev 1.0");

        ServerInfoService service = service(new HostInfoSnapshot(true, snapshotFile, CLOCK));

        assertThat(chosen(service)).isEqualTo("pi");
    }

    @Test
    void theFullReadingIsStampedWithWhenTheHostCapturedIt() throws IOException {
        writeSnapshot("Raspberry Pi 5 Model B Rev 1.0");

        BaseServerInfo info = service(new HostInfoSnapshot(true, snapshotFile, CLOCK)).getSystemInfo();

        assertThat(info.getHostSnapshotAt()).isEqualTo(Instant.ofEpochSecond(GENERATED).toString());
    }

    @Test
    void withNoSnapshotYetTheChoiceIsTheLiveOneAndNothingIsStamped() {
        ServerInfoService service = service(new HostInfoSnapshot(true, snapshotFile, CLOCK));

        BaseServerInfo info = service.getSystemInfo();

        assertThat(info.getError()).isEqualTo(hostModeChoice());
        assertThat(info.getHostSnapshotAt()).isNull();
    }

    @Test
    void aNonPiModelInTheSnapshotDoesNotForceThePiCollector() throws IOException {
        writeSnapshot("Some Other SBC v2");

        ServerInfoService service = service(new HostInfoSnapshot(true, snapshotFile, CLOCK));

        assertThat(chosen(service)).isEqualTo(hostModeChoice());
    }

    @Test
    void hostModeNeverConsultsTheSnapshot() throws IOException {
        writeSnapshot("Raspberry Pi 5 Model B Rev 1.0");
        HostInfoSnapshot hostMode = spy(new HostInfoSnapshot(false, snapshotFile, CLOCK));

        ServerInfoService service = service(hostMode);
        BaseServerInfo info = service.getSystemInfo();

        assertThat(info.getError()).isEqualTo(hostModeChoice());
        assertThat(info.getHostSnapshotAt()).isNull();
        verify(hostMode, never()).file(any());
        verify(hostMode, never()).generatedAt();
        verify(hostMode, never()).command(any());
        verify(hostMode, never()).exists(any());
        verify(hostMode, never()).statvfs(any());
    }
}
