package com.db.dbworld.app.downloader;

import java.net.Socket;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.apache.logging.log4j.Level;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.CloseableThreadContext;
import org.apache.logging.log4j.core.LogEvent;
import org.apache.logging.log4j.core.LoggerContext;
import org.apache.logging.log4j.core.appender.AbstractAppender;
import org.apache.logging.log4j.core.config.LoggerConfig;
import org.apache.logging.log4j.core.config.Property;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import static org.junit.jupiter.api.Assertions.*;

class DownloadEgressProxyTest {
    @Test
    @Timeout(10)
    void blockedDestinationsHaveStageDiagnosticsAndRequestCorrelation() throws Exception {
        String loggerName = DownloadEgressProxy.class.getName();
        var context = (LoggerContext) LogManager.getContext(false);
        var configuration = context.getConfiguration();
        var original = configuration.getLoggers().get(loggerName);
        var failure = new AtomicReference<LogEvent>();
        var captured = new CountDownLatch(1);
        var appender = new AbstractAppender("download-egress-test", null, null, true, Property.EMPTY_ARRAY) {
            @Override public void append(LogEvent event) {
                if (event.getMessage().getFormattedMessage().startsWith("Media egress failed")) {
                    failure.set(event.toImmutable());
                    captured.countDown();
                }
            }
        };
        appender.start();
        var loggerConfig = new LoggerConfig(loggerName, Level.INFO, false);
        loggerConfig.addAppender(appender, Level.INFO, null);
        configuration.addLogger(loggerName, loggerConfig);
        context.updateLoggers();
        try (var ignored = CloseableThreadContext.put("requestId", "fixture-request")) {
            try (var proxy = new DownloadEgressProxy("fixture-inspection"); var client = new Socket("127.0.0.1", URI.create(proxy.url()).getPort())) {
                client.setSoTimeout(3000);
                client.getOutputStream().write("CONNECT 127.0.0.1:443 HTTP/1.1\r\nAuthorization: Bearer private-token\r\n\r\n".getBytes(StandardCharsets.US_ASCII));
                assertEquals(-1, client.getInputStream().read());
                assertTrue(captured.await(3, TimeUnit.SECONDS));
                String message = failure.get().getMessage().getFormattedMessage();
                assertTrue(message.contains("stage=resolve-public-host"));
                assertTrue(message.contains("fixture-inspection"));
                assertFalse(message.contains("private-token"));
                assertEquals("fixture-request", failure.get().getContextData().getValue("requestId"));
            }
        } finally {
            configuration.removeLogger(loggerName);
            if (original != null) configuration.addLogger(loggerName, original);
            context.updateLoggers();
            appender.stop();
        }
    }
}