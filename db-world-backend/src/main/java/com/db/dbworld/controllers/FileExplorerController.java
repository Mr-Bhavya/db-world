package com.db.dbworld.controllers;

import com.db.dbworld.entities.fileexplorer.FileEntity;
import com.db.dbworld.payloads.ApiResponse;
import com.db.dbworld.payloads.fileexplorer.FileDto;
import com.db.dbworld.services.FileExplorerService;
import com.db.dbworld.utils.DbWorldConstants;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.URI;
import java.net.URL;
import java.net.URLDecoder;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/file-explorer")
public class FileExplorerController {
    @Autowired
    private FileExplorerService fileService;

    // Retrieve file metadata by ID.
    @GetMapping("/{id}")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ResponseEntity<FileEntity> getFile(@PathVariable UUID id) {
        FileEntity fileEntity = fileService.getFile(id);
        return ResponseEntity.ok(fileEntity);
    }

    // Rename a file.
    @PutMapping("/{id}/rename")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<String> renameFile(@PathVariable UUID id,
                                                 @RequestBody Map<String, Object> body) throws IOException {
        fileService.renameFile(id, (String) body.get("newName"));
        return new ApiResponse<>(HttpStatus.OK, true, "Rename Done.");
    }

    // Move a file to a new directory.
    @PutMapping("/{id}/move")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<String> moveFile(@PathVariable UUID id,
                                        @RequestBody Map<String, Object> body) throws IOException {
        fileService.moveFile(id, (String) body.get("newDirectory"));
        return new ApiResponse<>(HttpStatus.OK, true, "File is moved to "+ body.get("newDirectory"));
    }

    // Copy a file.
    @PostMapping("/{id}/copy")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<String> copyFile(@PathVariable UUID id,
                                               @RequestBody Map<String, Object> body) throws IOException {
        fileService.copyFile(id, (String) body.get("destinationDirectory"));
        return new ApiResponse<>(HttpStatus.OK, true, "File is initiate copy to "+ body.get("destinationDirectory"));
    }

    // Delete a file.
    @DeleteMapping("/{id}")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<String> deleteFile(@PathVariable UUID id) throws IOException {
        fileService.deleteFile(id);
        return new ApiResponse<>(HttpStatus.OK, true, "File deleted successfully");
    }

    // Upload a new file.
    @PostMapping("/upload")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ResponseEntity<FileEntity> uploadFile(@RequestParam String fileName,
                                                 @RequestParam String relativeDirectory,
                                                 @RequestParam MultipartFile file) throws IOException {
        FileEntity fileEntity = fileService.saveNewFile(fileName, relativeDirectory, file);
        return ResponseEntity.ok(fileEntity);
    }

    // List files in a given directory.
    @GetMapping("/list")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<List<FileDto>> listFiles(@RequestParam String directory) {
        List<FileDto> files = fileService.listFiles(URLDecoder.decode(directory));
        return new ApiResponse<>(HttpStatus.OK, true, files);
    }
}
