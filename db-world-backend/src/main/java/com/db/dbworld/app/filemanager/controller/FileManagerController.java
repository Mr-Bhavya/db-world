package com.db.dbworld.app.filemanager.controller;

import com.db.dbworld.app.filemanager.dto.FileItemDto;
import com.db.dbworld.app.filemanager.dto.FileListDto;
import com.db.dbworld.app.filemanager.dto.FileUploadResultDto;
import com.db.dbworld.app.filemanager.dto.request.FileOperationRequest;
import com.db.dbworld.app.filemanager.dto.request.MkdirRequest;
import com.db.dbworld.app.filemanager.dto.request.RenameRequest;
import com.db.dbworld.app.filemanager.service.FileManagerService;
import com.db.dbworld.core.role.annotations.AdminAccess;
import com.db.dbworld.payloads.ApiResponse;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Map;

@Log4j2
@RestController
@RequestMapping("/api/admin/file-manager")
@RequiredArgsConstructor
@AdminAccess
public class FileManagerController {

    private final FileManagerService service;

    @GetMapping("/list")
    public ApiResponse<FileListDto> list(
            @RequestParam(defaultValue = "/") String path,
            @RequestParam(defaultValue = "name")  String sortBy,
            @RequestParam(defaultValue = "asc")   String order) throws IOException {
        return ApiResponse.success(service.listDirectory(path, sortBy, order));
    }

    @GetMapping("/search")
    public ApiResponse<List<FileItemDto>> search(
            @RequestParam String q,
            @RequestParam(defaultValue = "/")    String path,
            @RequestParam(defaultValue = "true") boolean recursive) throws IOException {
        return ApiResponse.success(service.searchFiles(path, q, recursive));
    }

    @GetMapping("/info")
    public ApiResponse<FileItemDto> info(@RequestParam String path) throws IOException {
        return ApiResponse.success(service.getInfo(path));
    }

    @GetMapping("/download")
    public void download(@RequestParam String path, HttpServletResponse response) throws IOException {
        service.downloadFile(path, response);
    }

    /** Issues a one-time ticket so the browser can stream-download without loading into memory. */
    @PostMapping("/download-ticket")
    public ApiResponse<Map<String, String>> issueDownloadTicket(@RequestParam String path) {
        String ticketId = service.issueDownloadTicket(path);
        return ApiResponse.success(Map.of("ticketId", ticketId));
    }

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<FileUploadResultDto> upload(
            @RequestParam(defaultValue = "/") String path,
            @RequestParam("files") MultipartFile[] files) throws IOException {
        return ApiResponse.success(service.uploadFiles(path, files));
    }

    @PostMapping("/mkdir")
    public ApiResponse<FileItemDto> mkdir(@Valid @RequestBody MkdirRequest req) throws IOException {
        return ApiResponse.success(service.createDirectory(req.getPath(), req.getName()));
    }

    @PostMapping("/rename")
    public ApiResponse<FileItemDto> rename(@Valid @RequestBody RenameRequest req) throws IOException {
        return ApiResponse.success(service.renameItem(req.getPath(), req.getNewName()));
    }

    @PostMapping("/move")
    public ApiResponse<FileItemDto> move(@Valid @RequestBody FileOperationRequest req) throws IOException {
        return ApiResponse.success(service.moveItem(req.getSourcePath(), req.getDestinationPath()));
    }

    @PostMapping("/copy")
    public ApiResponse<FileItemDto> copy(@Valid @RequestBody FileOperationRequest req) throws IOException {
        return ApiResponse.success(service.copyItem(req.getSourcePath(), req.getDestinationPath()));
    }

    @DeleteMapping("/delete")
    public ApiResponse<Void> delete(@RequestParam String path) throws IOException {
        log.info("Admin delete request path={}", path);
        service.deleteItem(path);
        return ApiResponse.success("Deleted successfully");
    }
}
