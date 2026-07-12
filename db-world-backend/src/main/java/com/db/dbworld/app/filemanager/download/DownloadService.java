package com.db.dbworld.app.filemanager.download;

import com.db.dbworld.app.filemanager.location.FileLocationService;
import com.db.dbworld.app.filemanager.path.PathJail;
import com.db.dbworld.core.exception.DbWorldException;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Issues short-lived, reusable download tickets for files within a location, and streams the
 * referenced file back (range-aware) whenever a valid, unexpired ticket is presented. Tickets are
 * intentionally reusable within their TTL: a {@code <video>}/{@code <audio>} element issues many
 * HTTP Range requests (initial load + every seek) within one viewing session, and browser download
 * managers re-request with Range on resume.
 */
@Log4j2
@Service
public class DownloadService {

    private record DownloadTicket(String locationId, String path, Instant expiresAt) {}

    private final ConcurrentHashMap<String, DownloadTicket> tickets = new ConcurrentHashMap<>();

    private final FileLocationService locationService;

    private final long ticketTtlMs;

    public DownloadService(
            FileLocationService locationService,
            @Value("${dbworld.filemanager.download-ticket-ttl-ms:21600000}") long ticketTtlMs) {
        this.locationService = locationService;
        this.ticketTtlMs = ticketTtlMs;
    }

    /** Issues a reusable download ticket valid for {@code ticketTtlMs}ms. */
    public String issueTicket(String locationId, String path) throws IOException {
        log.debug("issueTicket locationId={} path={}", locationId, path);
        Path base = locationService.resolveBase(locationId);
        Path file;
        try {
            file = PathJail.resolveReal(base, path);
        } catch (IOException e) {
            throw new DbWorldException(HttpStatus.NOT_FOUND, "File not found: " + path);
        }
        if (!Files.isRegularFile(file)) {
            throw new DbWorldException(HttpStatus.BAD_REQUEST, "Not a file: " + path);
        }

        // Purge expired tickets to avoid unbounded growth.
        Instant now = Instant.now();
        tickets.entrySet().removeIf(e -> e.getValue().expiresAt().isBefore(now));

        String ticketId = UUID.randomUUID().toString();
        tickets.put(ticketId, new DownloadTicket(locationId, path, now.plusMillis(ticketTtlMs)));
        log.info("Issued download ticket locationId={} path={} (ttlMs={})", locationId, path, ticketTtlMs);
        return ticketId;
    }

    /** Validates the ticket (reusable until expiry) and streams the file directly to the response. */
    public void streamByTicket(String ticketId, String rangeHeader, HttpServletResponse response) throws IOException {
        DownloadTicket ticket = tickets.get(ticketId);
        if (ticket == null || ticket.expiresAt().isBefore(Instant.now())) {
            log.warn("Download ticket expired or invalid: {}", ticketId);
            response.sendError(HttpServletResponse.SC_GONE, "Download ticket expired or invalid");
            return;
        }
        Path base = locationService.resolveBase(ticket.locationId());
        Path file;
        try {
            file = PathJail.resolveReal(base, ticket.path());
        } catch (IOException e) {
            log.warn("Download ticket path no longer resolves: {}", ticket.path());
            response.sendError(HttpServletResponse.SC_NOT_FOUND, "File not found");
            return;
        }
        // asAttachment=false: keeps Content-Type as the real MIME so <video>/<audio> tags can play
        // inline and seek via range requests, rather than forcing a browser "Save As" download.
        RangeStreamer.stream(file, rangeHeader, response, false);
    }
}
