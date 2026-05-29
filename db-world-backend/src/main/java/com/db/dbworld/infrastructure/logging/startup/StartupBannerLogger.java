package com.db.dbworld.infrastructure.logging.startup;

import com.db.dbworld.config.AppProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.ApplicationListener;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import java.lang.management.ManagementFactory;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.time.Duration;
import java.util.Arrays;

/**
 * Logs a one-line startup summary once the application is fully ready.
 * Lands in both console and the request/info logs so operators can confirm:
 * which version, which JDK, which profile, which port, how long boot took.
 */
@Component
@Log4j2
@RequiredArgsConstructor
public class StartupBannerLogger implements ApplicationListener<ApplicationReadyEvent> {

    private final AppProperties appProperties;
    private final Environment environment;

    @Value("${server.port:0}")
    private int serverPort;

    @Override
    public void onApplicationEvent(ApplicationReadyEvent event) {
        long uptimeMs = ManagementFactory.getRuntimeMXBean().getUptime();
        String[] profiles = environment.getActiveProfiles();
        String profileStr = profiles.length == 0 ? "default" : String.join(",", profiles);

        log.info("=========================================================");
        log.info(" {} v{} READY",
                appProperties.getName(), appProperties.getVersion());
        log.info("  Profile : {}", profileStr);
        log.info("  Port    : {}", serverPort);
        log.info("  JDK     : {} ({})",
                System.getProperty("java.version"), System.getProperty("java.vendor"));
        log.info("  OS      : {} {} ({})",
                System.getProperty("os.name"),
                System.getProperty("os.version"),
                System.getProperty("os.arch"));
        log.info("  Host    : {}", resolveHost());
        log.info("  Boot    : {} ({} ms)",
                humanize(uptimeMs), uptimeMs);
        log.info("  PID     : {}", ProcessHandle.current().pid());
        log.info("  JVM args: {}", joinJvmArgs());
        log.info("=========================================================");
    }

    private String resolveHost() {
        try {
            return InetAddress.getLocalHost().getHostName();
        } catch (UnknownHostException e) {
            return "unknown";
        }
    }

    private String joinJvmArgs() {
        return ManagementFactory.getRuntimeMXBean().getInputArguments().stream()
                // Mask anything that smells like a secret in JVM args.
                .map(a -> a.toLowerCase().contains("password") || a.toLowerCase().contains("secret")
                        ? a.replaceAll("=.*", "=***")
                        : a)
                .reduce((a, b) -> a + " " + b)
                .orElse("");
    }

    private static String humanize(long ms) {
        Duration d = Duration.ofMillis(ms);
        long s = d.getSeconds();
        if (s < 60)   return s + "s";
        return (s / 60) + "m " + (s % 60) + "s";
    }
}
