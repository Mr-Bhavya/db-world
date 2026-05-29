package com.db.dbworld.app.filemanager.controller;

import com.db.dbworld.app.filemanager.service.FileManagerService;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;

/**
 * No @AdminAccess — this endpoint is open to all (but protected by one-time ticket).
 * Listed in PUBLIC_APIS so Spring Security's HTTP filter layer permits unauthenticated requests.
 * The ticket is a 60-second UUID issued by POST /download-ticket (which IS admin-protected).
 */
@Log4j2
@RestController
@RequestMapping("/api/admin/file-manager")
@RequiredArgsConstructor
public class FileDownloadStreamController {

    private final FileManagerService service;

    @GetMapping("/download/stream")
    public void downloadStream(@RequestParam String ticket, HttpServletResponse response) throws IOException {
        log.debug("downloadStream ticket={}", ticket);
        service.downloadFileWithTicket(ticket, response);
    }
}
