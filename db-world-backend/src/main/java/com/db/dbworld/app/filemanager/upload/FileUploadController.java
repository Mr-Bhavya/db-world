package com.db.dbworld.app.filemanager.upload;

import com.db.dbworld.app.filemanager.dto.FileItemDto;
import com.db.dbworld.app.filemanager.upload.dto.InitUploadRequest;
import com.db.dbworld.app.filemanager.upload.dto.UploadSessionDto;
import com.db.dbworld.core.role.annotations.AdminAccess;
import com.db.dbworld.payloads.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;

@Log4j2
@RestController
@RequestMapping("/api/admin/file-manager/uploads")
@RequiredArgsConstructor
@AdminAccess
public class FileUploadController {

    private final UploadSessionService service;

    @PostMapping("/init")
    public ApiResponse<UploadSessionDto> init(@Valid @RequestBody InitUploadRequest req) throws IOException {
        return ApiResponse.success(service.init(req));
    }

    @PutMapping(value = "/{uploadId}/chunk", consumes = MediaType.APPLICATION_OCTET_STREAM_VALUE)
    public ApiResponse<UploadSessionDto> chunk(@PathVariable String uploadId,
                                                @RequestParam int index,
                                                @RequestBody byte[] data) throws IOException {
        service.appendChunk(uploadId, index, data);
        return ApiResponse.success(service.status(uploadId));
    }

    @GetMapping("/{uploadId}")
    public ApiResponse<UploadSessionDto> status(@PathVariable String uploadId) {
        return ApiResponse.success(service.status(uploadId));
    }

    @PostMapping("/{uploadId}/complete")
    public ApiResponse<FileItemDto> complete(@PathVariable String uploadId) throws IOException {
        return ApiResponse.success(service.complete(uploadId));
    }

    @DeleteMapping("/{uploadId}")
    public ApiResponse<Void> abort(@PathVariable String uploadId) throws IOException {
        log.info("Admin abort upload request uploadId={}", uploadId);
        service.abort(uploadId);
        return ApiResponse.success("Upload aborted");
    }
}
