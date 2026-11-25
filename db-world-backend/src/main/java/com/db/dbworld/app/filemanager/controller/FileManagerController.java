package com.db.dbworld.app.filemanager.controller;

import com.db.dbworld.api.response.ApiResponse;
import com.db.dbworld.app.filemanager.download.DownloadService;
import com.db.dbworld.app.filemanager.dto.FileItemDto;
import com.db.dbworld.app.filemanager.dto.FileListDto;
import com.db.dbworld.app.filemanager.dto.request.FileOperationRequest;
import com.db.dbworld.app.filemanager.dto.request.MkdirRequest;
import com.db.dbworld.app.filemanager.dto.request.RenameRequest;
import com.db.dbworld.app.filemanager.service.FileOperationsService;
import com.db.dbworld.core.role.annotations.AdminAccess;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.nio.file.NoSuchFileException;
import java.util.List;
import java.util.Map;

@Log4j2
@RestController
@RequestMapping("/api/admin/file-manager")
@RequiredArgsConstructor
@AdminAccess
public class FileManagerController {

    private final FileOperationsService service;
    private final DownloadService downloadService;

    @ExceptionHandler(NoSuchFileException.class)
    public ResponseEntity<ApiResponse<Void>> handleMissingFile(NoSuchFileException ex) {
        log.warn("File not found: {}", ex.getFile());
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiResponse.error(HttpStatus.NOT_FOUND, "File not found: " + ex.getFile()));
    }

    @ExceptionHandler(IOException.class)
    public ResponseEntity<ApiResponse<Void>> handleFileIOException(IOException ex) {
        log.error("File manager operation failed", ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error(HttpStatus.INTERNAL_SERVER_ERROR, "File operation failed"));
    }

    @GetMapping("/list")
    public ApiResponse<FileListDto> list(
            @RequestParam String locationId,
            @RequestParam(defaultValue = "/") String path,
            @RequestParam(defaultValue = "name")  String sortBy,
            @RequestParam(defaultValue = "asc")   String order) throws IOException {
        return ApiResponse.success(service.list(locationId, path, sortBy, order));
    }

    @GetMapping("/search")
    public ApiResponse<List<FileItemDto>> search(
            @RequestParam String locationId,
            @RequestParam String q,
            @RequestParam(defaultValue = "/")    String path,
            @RequestParam(defaultValue = "true") boolean recursive,
            @RequestParam(defaultValue = "200")  int limit) throws IOException {
        return ApiResponse.success(service.search(locationId, path, q, recursive, limit));
    }

    @GetMapping("/info")
    public ApiResponse<FileItemDto> info(@RequestParam String locationId, @RequestParam String path) throws IOException {
        return ApiResponse.success(service.info(locationId, path));
    }

    @PostMapping("/mkdir")
    public ApiResponse<FileItemDto> mkdir(@Valid @RequestBody MkdirRequest req) throws IOException {
        return ApiResponse.success(service.mkdir(req.getLocationId(), req.getPath(), req.getName()));
    }

    @PostMapping("/rename")
    public ApiResponse<FileItemDto> rename(@Valid @RequestBody RenameRequest req) throws IOException {
        return ApiResponse.success(service.renameItem(req.getLocationId(), req.getPath(), req.getNewName()));
    }

    @PostMapping("/move")
    public ApiResponse<FileItemDto> move(@Valid @RequestBody FileOperationRequest req) throws IOException {
        return ApiResponse.success(service.moveItem(req.getLocationId(), req.getSourcePath(), req.getDestinationPath()));
    }

    @PostMapping("/copy")
    public ApiResponse<FileItemDto> copy(@Valid @RequestBody FileOperationRequest req) throws IOException {
        return ApiResponse.success(service.copyItem(req.getLocationId(), req.getSourcePath(), req.getDestinationPath()));
    }

    @DeleteMapping("/delete")
    public ApiResponse<Void> delete(@RequestParam String locationId, @RequestParam String path) throws IOException {
        log.info("Admin delete request locationId={} path={}", locationId, path);
        service.delete(locationId, path);
        return ApiResponse.success("Deleted successfully");
    }

    @PostMapping("/download-ticket")
    public ApiResponse<Map<String, String>> issueDownloadTicket(@RequestParam String locationId, @RequestParam String path) throws IOException {
        String ticketId = downloadService.issueTicket(locationId, path);
        return ApiResponse.success(Map.of("ticketId", ticketId));
    }
}
