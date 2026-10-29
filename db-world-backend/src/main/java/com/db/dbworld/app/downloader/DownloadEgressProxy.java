package com.db.dbworld.app.downloader;

import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

final class DownloadEgressProxy implements AutoCloseable {
    private final ServerSocket server;
    private final Set<Socket> sockets = ConcurrentHashMap.newKeySet();

    DownloadEgressProxy() throws IOException {
        server = new ServerSocket(0, 50, InetAddress.getByName("127.0.0.1"));
        Thread.startVirtualThread(() -> {
            while (!server.isClosed()) {
                try {
                    Socket client = server.accept();
                    sockets.add(client);
                    Thread.startVirtualThread(() -> handle(client));
                } catch (IOException ignored) {
                    break;
                }
            }
        });
    }

    String url() { return "http://127.0.0.1:" + server.getLocalPort(); }

    private void handle(Socket client) {
        try (client) {
            client.setSoTimeout(60_000);
            InputStream input = client.getInputStream();
            String request = line(input);
            String[] parts = request.split(" ", 3);
            if (parts.length != 3) throw new IOException("Invalid proxy request");
            boolean tunnel = parts[0].equals("CONNECT");
            URI target = URI.create(tunnel ? "https://" + parts[1] : parts[1]);
            int port = target.getPort() < 0 ? (tunnel ? 443 : 80) : target.getPort();
            if (target.getHost() == null || target.getUserInfo() != null || (port != 80 && port != 443)
                    || (!tunnel && !"http".equals(target.getScheme()))) throw new IOException("Blocked target");
            InetAddress destination = DownloadPolicy.requirePublicHost(target.getHost());
            try (Socket upstream = new Socket()) {
                upstream.connect(new InetSocketAddress(destination, port), 20_000);
                upstream.setSoTimeout(60_000);
                sockets.add(upstream);
                try {
                    OutputStream remote = upstream.getOutputStream();
                    StringBuilder headers = new StringBuilder();
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
                    try { upstream.getInputStream().transferTo(client.getOutputStream()); }
                    finally { sender.interrupt(); }
                } finally { sockets.remove(upstream); }
            }
        } catch (Exception ignored) {
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
    }
}