package com.db.dbworld.app.wallet.controller;

import com.db.dbworld.app.wallet.dto.UpsertDocumentTypeRequest;
import com.db.dbworld.app.wallet.dto.WalletDocumentTypeDto;
import com.db.dbworld.app.wallet.dto.WalletStatsDto;
import com.db.dbworld.app.wallet.mapper.WalletMapper;
import com.db.dbworld.app.wallet.service.WalletStatsService;
import com.db.dbworld.app.wallet.service.WalletTypeService;
import com.db.dbworld.core.role.annotations.AdminAccess;
import com.db.dbworld.payloads.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/wallet")
@RequiredArgsConstructor
@AdminAccess
public class WalletAdminController {

    private final WalletTypeService typeService;
    private final WalletStatsService statsService;
    private final WalletMapper mapper;

    @GetMapping("/types")
    public ApiResponse<List<WalletDocumentTypeDto>> listTypes() {
        return ApiResponse.success(typeService.listAll().stream().map(mapper::toTypeDto).toList());
    }

    @PostMapping("/types")
    public ApiResponse<WalletDocumentTypeDto> createType(@Valid @RequestBody UpsertDocumentTypeRequest req) {
        return ApiResponse.success("Document type created", mapper.toTypeDto(typeService.create(req)));
    }

    @PutMapping("/types/{id}")
    public ApiResponse<WalletDocumentTypeDto> updateType(@PathVariable String id,
                                                         @Valid @RequestBody UpsertDocumentTypeRequest req) {
        return ApiResponse.success("Document type updated", mapper.toTypeDto(typeService.update(id, req)));
    }

    @DeleteMapping("/types/{id}")
    public ApiResponse<Void> deleteType(@PathVariable String id) {
        boolean deleted = typeService.deleteOrDeactivate(id);
        return ApiResponse.success(deleted ? "Document type deleted"
                                            : "Document type is in use — deactivated instead");
    }

    @GetMapping("/stats")
    public ApiResponse<WalletStatsDto> stats() {
        return ApiResponse.success(statsService.stats());
    }
}
