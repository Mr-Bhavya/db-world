package com.db.dbworld.app.filemanager.controller;

import com.db.dbworld.app.filemanager.dto.FileItemDto;
import com.db.dbworld.app.filemanager.dto.FileListDto;
import com.db.dbworld.app.filemanager.dto.request.FileOperationRequest;
import com.db.dbworld.app.filemanager.dto.request.MkdirRequest;
import com.db.dbworld.app.filemanager.dto.request.RenameRequest;
import com.db.dbworld.app.filemanager.service.FileOperationsService;
import com.db.dbworld.core.role.annotations.AdminAccess;
import com.db.dbworld.payloads.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.List;

@Log4j2
@RestController
@RequestMapping("/api/admin/file-manager")
@RequiredArgsConstructor
@AdminAccess
public class FileManagerController {

    private final FileOperationsService service;

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
            @RequestParam(defaultValue = "true") boolean recursive) throws IOException {
        return ApiResponse.success(service.search(locationId, path, q, recursive));
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
}
