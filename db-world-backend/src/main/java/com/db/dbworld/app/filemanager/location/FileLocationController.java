package com.db.dbworld.app.filemanager.location;

import com.db.dbworld.app.filemanager.location.dto.FileLocationDto;
import com.db.dbworld.app.filemanager.location.dto.UpsertLocationRequest;
import com.db.dbworld.app.filemanager.mapper.FileMetadataMapper;
import com.db.dbworld.core.role.annotations.AdminAccess;
import com.db.dbworld.payloads.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/file-manager/locations")
@RequiredArgsConstructor
@AdminAccess
public class FileLocationController {

    private final FileLocationService service;

    @GetMapping("")
    public ApiResponse<List<FileLocationDto>> list() {
        return ApiResponse.success(service.listAll().stream().map(FileMetadataMapper::toLocationDto).toList());
    }

    @PostMapping("")
    public ApiResponse<FileLocationDto> create(@Valid @RequestBody UpsertLocationRequest req) {
        return ApiResponse.success("Location created", FileMetadataMapper.toLocationDto(service.create(req)));
    }

    @PutMapping("/{id}")
    public ApiResponse<FileLocationDto> update(@PathVariable String id, @Valid @RequestBody UpsertLocationRequest req) {
        return ApiResponse.success("Location updated", FileMetadataMapper.toLocationDto(service.update(id, req)));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) {
        service.delete(id);
        return ApiResponse.success("Location deleted");
    }
}
