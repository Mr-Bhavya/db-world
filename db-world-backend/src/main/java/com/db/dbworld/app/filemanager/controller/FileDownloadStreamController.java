package com.db.dbworld.app.filemanager.controller;

import com.db.dbworld.app.filemanager.download.DownloadService;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;

/**
 * No @AdminAccess — this endpoint is open to all (but protected by a ticket).
 * Listed in PUBLIC_APIS so Spring Security's HTTP filter layer permits unauthenticated requests.
 * The ticket is a reusable UUID issued by POST /download-ticket (which IS admin-protected), valid
 * for a configurable TTL (default 6h, see {@code dbworld.filemanager.download-ticket-ttl-ms} /
 * {@link com.db.dbworld.app.filemanager.download.DownloadService}) so a single ticket can serve
 * every Range request a video/audio element or resumed download issues during that window.
 */
@Log4j2
@RestController
@RequestMapping("/api/admin/file-manager")
@RequiredArgsConstructor
public class FileDownloadStreamController {

    private final DownloadService downloadService;

    @GetMapping("/download/stream")
    public void downloadStream(@RequestParam String ticket,
                                @RequestParam(name = "download", required = false, defaultValue = "false") boolean download,
                                @RequestHeader(value = "Range", required = false) String range,
                                HttpServletResponse response) throws IOException {
        log.debug("downloadStream ticket={} range={} download={}", ticket, range, download);
        downloadService.streamByTicket(ticket, range, download, response);
    }
}
