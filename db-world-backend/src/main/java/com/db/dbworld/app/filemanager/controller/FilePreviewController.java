package com.db.dbworld.app.filemanager.controller;

import com.db.dbworld.app.filemanager.preview.ThumbnailService;
import com.db.dbworld.app.filemanager.preview.TextPreviewService;
import com.db.dbworld.app.filemanager.preview.dto.TextPreviewDto;
import com.db.dbworld.core.role.annotations.AdminAccess;
import com.db.dbworld.payloads.ApiResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;

@Log4j2
@RestController
@RequestMapping("/api/admin/file-manager")
@RequiredArgsConstructor
@AdminAccess
public class FilePreviewController {

    private final TextPreviewService textPreviewService;
    private final ThumbnailService thumbnailService;

    @GetMapping("/preview/text")
    public ApiResponse<TextPreviewDto> previewText(@RequestParam String locationId, @RequestParam String path) throws IOException {
        return ApiResponse.success(textPreviewService.readHead(locationId, path));
    }

    @GetMapping(value = "/thumbnail", produces = MediaType.IMAGE_JPEG_VALUE)
    public ResponseEntity<byte[]> thumbnail(@RequestParam String locationId, @RequestParam String path) throws IOException {
        byte[] jpeg = thumbnailService.thumbnail(locationId, path);
        return ResponseEntity.ok().contentType(MediaType.IMAGE_JPEG).body(jpeg);
    }
}
