package com.db.dbworld.app.downloader;

import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.Set;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import lombok.extern.log4j.Log4j2;
import org.apache.logging.log4j.CloseableThreadContext;
import org.apache.logging.log4j.ThreadContext;

@Log4j2
final class DownloadEgressProxy implements AutoCloseable {
    private final ServerSocket server;
    private final Set<Socket> sockets = ConcurrentHashMap.newKeySet();
    private final String inspectionId;
    private final Map<String, String> context;
    private final AtomicLong accepted = new AtomicLong();
    private final AtomicLong failed = new AtomicLong();
    private final AtomicLong receivedBytes = new AtomicLong();

    DownloadEgressProxy() throws IOException {
        this("preparation");
    }

    DownloadEgressProxy(String inspectionId) throws IOException {
        this.inspectionId = inspectionId;
        this.context = ThreadContext.getImmutableContext();
        server = new ServerSocket(0, 50, InetAddress.getByName("127.0.0.1"));
        Thread.startVirtualThread(() -> {
            while (!server.isClosed()) {
                try {
                    Socket client = server.accept();
                    accepted.incrementAndGet();
                    sockets.add(client);
                    Thread.startVirtualThread(() -> {
                        try (var ignored = CloseableThreadContext.putAll(context)) { handle(client); }
                    });
                } catch (IOException ignored) {
                    break;
                }
            }
        });
    }

    String url() { return "http://127.0.0.1:" + server.getLocalPort(); }

    private void handle(Socket client) {
        long startedAt = System.nanoTime();
        String stage = "read-request";
        String host = "unknown";
        try (client) {
            client.setSoTimeout(60_000);
            InputStream input = client.getInputStream();
            String request = line(input);
            String[] parts = request.split(" ", 3);
            if (parts.length != 3) throw new IOException("Invalid proxy request");
            boolean tunnel = parts[0].equals("CONNECT");
            stage = "validate-target";
            URI target = URI.create(tunnel ? "https://" + parts[1] : parts[1]);
            host = target.getHost() == null ? "invalid" : target.getHost();
            int port = target.getPort() < 0 ? (tunnel ? 443 : 80) : target.getPort();
            if (target.getHost() == null || target.getUserInfo() != null || (port != 80 && port != 443)
                    || (!tunnel && !"http".equals(target.getScheme()))) throw new IOException("Blocked target");
            stage = "resolve-public-host";
                log.info("Media egress resolving inspection={} host={}", inspectionId, DownloadDiagnostics.safeText(host));
            InetAddress destination = DownloadPolicy.requirePublicHost(target.getHost());
            try (Socket upstream = new Socket()) {
                stage = "connect-upstream";
                log.info("Media egress connecting inspection={} host={} addressFamily={} elapsedMs={}", inspectionId, DownloadDiagnostics.safeText(host),
                    destination instanceof Inet6Address ? "IPv6" : "IPv4", java.time.Duration.ofNanos(System.nanoTime() - startedAt).toMillis());
                upstream.connect(new InetSocketAddress(destination, port), 20_000);
                log.info("Media egress connected inspection={} host={} elapsedMs={}", inspectionId, DownloadDiagnostics.safeText(host),
                    java.time.Duration.ofNanos(System.nanoTime() - startedAt).toMillis());
                upstream.setSoTimeout(60_000);
                sockets.add(upstream);
                try {
                    OutputStream remote = upstream.getOutputStream();
                    StringBuilder headers = new StringBuilder();
                    stage = "read-headers";
                    String header;
                    while (!(header = line(input)).isEmpty()) {
                        if (headers.length() > 65_536) throw new IOException("Headers too large");
                        String lower = header.toLowerCase(java.util.Locale.ROOT);
                        if (!lower.startsWith("proxy-") && !lower.startsWith("connection:")) headers.append(header).append("\r\n");
                    }
                    if (tunnel) {
                        client.getOutputStream().write("HTTP/1.1 200 Connection Established\r\n\r\n".getBytes(StandardCharsets.US_ASCII));
                    } else {
                        String path = target.getRawPath();
                        if (path == null || path.isEmpty()) path = "/";
                        if (target.getRawQuery() != null) path += "?" + target.getRawQuery();
                        remote.write((parts[0] + " " + path + " HTTP/1.1\r\n" + headers + "Connection: close\r\n\r\n").getBytes(StandardCharsets.ISO_8859_1));
                    }
                    Thread sender = Thread.startVirtualThread(() -> {
                        try { input.transferTo(remote); upstream.shutdownOutput(); } catch (IOException ignored) { }
                    });
                    stage = "relay";
                    try { receivedBytes.addAndGet(upstream.getInputStream().transferTo(client.getOutputStream())); }
                    finally { sender.interrupt(); }
                } finally { sockets.remove(upstream); }
            }
        } catch (Exception exception) {
            failed.incrementAndGet();
            if (!server.isClosed()) log.warn("Media egress failed inspection={} host={} stage={} elapsedMs={} exceptionType={} diagnostic={}",
                    inspectionId, DownloadDiagnostics.safeText(host), stage, java.time.Duration.ofNanos(System.nanoTime() - startedAt).toMillis(),
                    exception.getClass().getSimpleName(), DownloadDiagnostics.safeText(exception.getMessage()));
            try { client.close(); } catch (IOException ignoredClose) { }
        } finally { sockets.remove(client); }
    }

    private static String line(InputStream input) throws IOException {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        int next;
        while ((next = input.read()) != -1) {
            if (next == '\n') return bytes.toString(StandardCharsets.ISO_8859_1).replace("\r", "");
            if (bytes.size() > 8192) throw new IOException("Line too large");
            bytes.write(next);
        }
        throw new EOFException();
    }

    @Override public void close() throws IOException {
        server.close();
        for (Socket socket : sockets) try { socket.close(); } catch (IOException ignored) { }
        log.info("Media egress summary inspection={} connections={} failedConnections={} receivedBytes={}", inspectionId, accepted.get(), failed.get(), receivedBytes.get());
    }
}