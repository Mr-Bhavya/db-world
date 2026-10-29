package com.db.dbworld.app.downloader;

import com.db.dbworld.config.AppConstants;
import java.nio.file.*;
import java.util.List;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/downloader")
@PreAuthorize("isAuthenticated()")
public class MediaDownloaderController {
    private final MediaDownloaderService service;

    public MediaDownloaderController(MediaDownloaderService service) { this.service = service; }

    public record InspectRequest(String url, boolean playlist) {}
    public record TicketRequest(List<String> ids, String name, boolean nativeClient) {}

    @PostMapping("/tickets")
    public java.util.Map<String, String> ticket(Authentication auth, @RequestBody TicketRequest request) throws Exception {
        return java.util.Map.of("url", service.ticket(auth.getName(), request.ids(), request.name(), request.nativeClient()));
    }

    @GetMapping("/transfers/{token}")
    @PreAuthorize("permitAll()")
    public ResponseEntity<?> transfer(@PathVariable String token) throws Exception {
        MediaDownloaderService.Ticket ticket = service.redeem(token);
        if (ticket.ids().size() == 1) return resource(service.file(ticket.ids().getFirst(), ticket.owner(), ticket.name()));
        for (String id : ticket.ids()) service.file(id, ticket.owner(), null);
        org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody body = output -> {
            try (java.util.zip.ZipOutputStream archive = new java.util.zip.ZipOutputStream(output)) {
                archive.setLevel(0);
                for (String id : ticket.ids()) {
                    Path path = service.file(id, ticket.owner(), null);
                    archive.putNextEntry(new java.util.zip.ZipEntry(id + "/" + path.getFileName()));
                    Files.copy(path, archive);
                    archive.closeEntry();
                }
            }
        };
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).header("Referrer-Policy", "no-referrer")
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=media-downloads.zip")
                .contentType(MediaType.parseMediaType("application/zip")).body(body);
    }

    private ResponseEntity<FileSystemResource> resource(Path path) throws Exception {
        String mime = Files.probeContentType(path);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).header("Referrer-Policy", "no-referrer")
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(path.getFileName().toString(), java.nio.charset.StandardCharsets.UTF_8).build().toString())
                .contentType(mime == null ? MediaType.APPLICATION_OCTET_STREAM : MediaType.parseMediaType(mime))
                .body(new FileSystemResource(path));
    }

    @PostMapping("/inspect")
    public MediaDownloaderService.Preview inspect(@RequestBody InspectRequest request) {
        try { return service.inspect(request.url(), request.playlist()); }
        catch (ResponseStatusException exception) { throw exception; }
        catch (Exception exception) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, MediaDownloaderService.failureReason(exception.getMessage()));
        }
    }

    @PostMapping("/jobs")
    public List<MediaDownloaderService.JobView> create(Authentication auth, @RequestBody MediaDownloaderService.Request request) {
        return service.submit(auth.getName(), request);
    }

    @GetMapping("/jobs")
    public List<MediaDownloaderService.JobView> list(Authentication auth) { return service.list(auth.getName(), false); }

    @PostMapping("/jobs/{id}/cancel")
    public void cancel(Authentication auth, @PathVariable String id) { service.cancel(id, auth.getName(), false); }

    @PostMapping("/jobs/{id}/retry")
    public void retry(Authentication auth, @PathVariable String id) { service.retry(id, auth.getName(), false); }

    @DeleteMapping("/jobs/{id}")
    public void delete(Authentication auth, @PathVariable String id) throws Exception { service.delete(id, auth.getName(), false); }

    @GetMapping("/jobs/{id}/files")
    public List<String> files(Authentication auth, @PathVariable String id) throws Exception { return service.files(id, auth.getName()); }

    @GetMapping("/jobs/{id}/file")
    public ResponseEntity<FileSystemResource> file(Authentication auth, @PathVariable String id,
                                                    @RequestParam(required = false) String name) throws Exception {
        return resource(service.file(id, auth.getName(), name));
    }

    @GetMapping("/admin/jobs")
    @PreAuthorize(AppConstants.OWNER_ADMIN_AUTHORIZE)
    public List<MediaDownloaderService.JobView> adminList(Authentication auth) { return service.list(auth.getName(), true); }

    @PostMapping("/admin/jobs/{id}/{action}")
    @PreAuthorize(AppConstants.OWNER_ADMIN_AUTHORIZE)
    public void adminAction(Authentication auth, @PathVariable String id, @PathVariable String action) throws Exception {
        switch (action) {
            case "cancel" -> service.cancel(id, auth.getName(), true);
            case "retry" -> service.retry(id, auth.getName(), true);
            case "delete" -> service.delete(id, auth.getName(), true);
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown action.");
        }
    }

    @PostMapping("/admin/cleanup")
    @PreAuthorize(AppConstants.OWNER_ADMIN_AUTHORIZE)
    public int cleanup() throws Exception { return service.cleanup(); }
}