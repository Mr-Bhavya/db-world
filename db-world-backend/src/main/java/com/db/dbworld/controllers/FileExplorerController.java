package com.db.dbworld.controllers;

import com.db.dbworld.entities.fileexplorer.FileEntity;
import com.db.dbworld.payloads.ApiResponse;
import com.db.dbworld.payloads.fileexplorer.FileDto;
import com.db.dbworld.services.explorer.FileExplorerService;
import com.db.dbworld.utils.DbWorldConstants;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/file-explorer")
public class FileExplorerController {

    private final FileExplorerService fileService;

    public FileExplorerController(FileExplorerService fileService) {
        this.fileService = fileService;
    }

    @GetMapping("/{id}")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<FileEntity> getFile(@PathVariable UUID id) {
        return ApiResponse.success(fileService.getFile(id));
    }

    @PutMapping("/{id}/rename")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<Void> renameFile(@PathVariable UUID id,@RequestBody Map<String,Object> body) throws IOException {
        fileService.renameFile(id,(String) body.get("newName"));
        return ApiResponse.success("Rename completed");
    }

    @PutMapping("/{id}/move")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<Void> moveFile(@PathVariable UUID id,@RequestBody Map<String,Object> body) throws IOException {
        String target=(String) body.get("newDirectory");
        fileService.moveFile(id,target);
        return ApiResponse.success("File moved to "+target);
    }

    @PostMapping("/{id}/copy")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<Void> copyFile(@PathVariable UUID id,@RequestBody Map<String,Object> body) throws IOException {
        String dest=(String) body.get("destinationDirectory");
        fileService.copyFile(id,dest);
        return ApiResponse.success("File copy initiated to "+dest);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<Void> deleteFile(@PathVariable UUID id) throws IOException {
        fileService.deleteFile(id);
        return ApiResponse.success("File deleted successfully");
    }

    @PostMapping("/upload")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<FileEntity> uploadFile(@RequestParam String fileName,@RequestParam String relativeDirectory,@RequestParam MultipartFile file) throws IOException {
        return ApiResponse.success(fileService.saveNewFile(fileName,relativeDirectory,file));
    }

    @GetMapping("/list")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<List<FileDto>> listFiles(@RequestParam String directory) {
        return ApiResponse.success(fileService.listFiles(URLDecoder.decode(directory,StandardCharsets.UTF_8)));
    }
}
