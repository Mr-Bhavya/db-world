package com.db.dbworld.app.system.info.collector.linux;

import com.db.dbworld.app.system.info.dto.ServiceInfo;
import com.db.dbworld.core.processor.ProcessExecutor;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

/**
 * Regression coverage for the systemctl "●" (bullet) column-shift bug.
 *
 * Historically, a leading colored status glyph on failed/degraded unit lines (e.g. "● nginx.service ...")
 * shifted every whitespace-split column by one, producing a bogus service literally named "●" while the
 * real unit name landed in the "loaded" field. {@link LinuxServerInfoCollector#getRunningServices()} now
 * strips a leading status glyph before splitting columns; this test drives that parse via the overridable
 * {@code exec(...)} seam with canned systemctl output so the regression can't creep back in silently.
 */
class LinuxServerInfoCollectorServicesTest {

    private static final String SYSTEMCTL_OUTPUT = """
            accounts-daemon.service loaded active running Accounts Service
            ● nginx.service loaded failed failed A high performance web server
            cron.service loaded active running Regular background program processing daemon""";

    private List<ServiceInfo> parse(String canned) {
        LinuxServerInfoCollector collector = new LinuxServerInfoCollector(mock(ProcessExecutor.class)) {
            @Override
            protected String exec(int timeoutSeconds, String... command) {
                return canned;
            }
        };
        return collector.getRunningServices();
    }

    @Test
    void bulletPrefixedFailedUnit_doesNotProduceBogusService() {
        List<ServiceInfo> services = parse(SYSTEMCTL_OUTPUT);

        assertThat(services).extracting(ServiceInfo::getName).doesNotContain("●");
    }

    @Test
    void bulletPrefixedFailedUnit_parsesRealNameAndSensibleState() {
        List<ServiceInfo> services = parse(SYSTEMCTL_OUTPUT);

        ServiceInfo nginx = services.stream()
                .filter(s -> "nginx".equals(s.getName()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("nginx service not parsed from: " + services));

        assertThat(nginx.getLoaded()).isEqualTo("loaded");
        assertThat(nginx.getActive()).isEqualTo("failed");
        assertThat(nginx.getStatus()).isEqualTo("failed");
        assertThat(nginx.getRunning()).isFalse();
        assertThat(nginx.getDescription()).isEqualTo("A high performance web server");
    }

    @Test
    void normalUnits_parseCorrectly() {
        List<ServiceInfo> services = parse(SYSTEMCTL_OUTPUT);
        assertThat(services).hasSize(3);

        ServiceInfo accounts = services.stream()
                .filter(s -> "accounts-daemon".equals(s.getName()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("accounts-daemon not parsed from: " + services));
        assertThat(accounts.getLoaded()).isEqualTo("loaded");
        assertThat(accounts.getActive()).isEqualTo("active");
        assertThat(accounts.getStatus()).isEqualTo("running");
        assertThat(accounts.getRunning()).isTrue();
        assertThat(accounts.getDescription()).isEqualTo("Accounts Service");

        ServiceInfo cron = services.stream()
                .filter(s -> "cron".equals(s.getName()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("cron not parsed from: " + services));
        assertThat(cron.getActive()).isEqualTo("active");
        assertThat(cron.getRunning()).isTrue();
    }
}
