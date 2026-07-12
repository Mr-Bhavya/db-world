package com.db.dbworld.app.filemanager.download;

import com.db.dbworld.app.filemanager.location.FileLocationService;
import com.db.dbworld.app.filemanager.path.PathJail;
import com.db.dbworld.core.exception.DbWorldException;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Issues short-lived, one-time download tickets for files within a location, and streams the
 * referenced file back (range-aware) once a valid ticket is redeemed.
 */
@Log4j2
@Service
@RequiredArgsConstructor
public class DownloadService {

    private static final long TICKET_TTL_MS = 60_000; // 60-second one-time download tokens

    private record DownloadTicket(String locationId, String path, Instant expiresAt) {}

    private final ConcurrentHashMap<String, DownloadTicket> tickets = new ConcurrentHashMap<>();

    private final FileLocationService locationService;

    /** Issues a one-time download ticket valid for {@value TICKET_TTL_MS}ms. */
    public String issueTicket(String locationId, String path) throws IOException {
        log.debug("issueTicket locationId={} path={}", locationId, path);
        Path base = locationService.resolveBase(locationId);
        Path file = PathJail.resolve(base, path);
        if (!Files.isRegularFile(file)) {
            throw new DbWorldException(HttpStatus.BAD_REQUEST, "Not a file: " + path);
        }

        // Purge expired tickets to avoid unbounded growth.
        Instant now = Instant.now();
        tickets.entrySet().removeIf(e -> e.getValue().expiresAt().isBefore(now));

        String ticketId = UUID.randomUUID().toString();
        tickets.put(ticketId, new DownloadTicket(locationId, path, now.plusMillis(TICKET_TTL_MS)));
        log.info("Issued download ticket locationId={} path={} (ttlMs={})", locationId, path, TICKET_TTL_MS);
        return ticketId;
    }

    /** Validates the ticket (one-time use) and streams the file directly to the response. */
    public void streamByTicket(String ticketId, String rangeHeader, HttpServletResponse response) throws IOException {
        DownloadTicket ticket = tickets.remove(ticketId);
        if (ticket == null || ticket.expiresAt().isBefore(Instant.now())) {
            log.warn("Download ticket expired or invalid: {}", ticketId);
            response.sendError(HttpServletResponse.SC_GONE, "Download ticket expired or invalid");
            return;
        }
        Path base = locationService.resolveBase(ticket.locationId());
        Path file = PathJail.resolve(base, ticket.path());
        // asAttachment=false: keeps Content-Type as the real MIME so <video>/<audio> tags can play
        // inline and seek via range requests, rather than forcing a browser "Save As" download.
        RangeStreamer.stream(file, rangeHeader, response, false);
    }
}
