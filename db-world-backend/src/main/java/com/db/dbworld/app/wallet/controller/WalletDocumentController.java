package com.db.dbworld.app.wallet.controller;

import com.db.dbworld.app.wallet.dto.*;
import com.db.dbworld.app.wallet.mapper.WalletMapper;
import com.db.dbworld.app.wallet.service.WalletDocumentService;
import com.db.dbworld.app.wallet.service.WalletTypeService;
import com.db.dbworld.core.context.UserContext;
import com.db.dbworld.core.role.annotations.AnyRole;
import com.db.dbworld.payloads.ApiResponse;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/wallet")
@RequiredArgsConstructor
@AnyRole
public class WalletDocumentController {

    private final WalletDocumentService documentService;
    private final WalletTypeService typeService;
    private final WalletMapper mapper;
    private final UserContext userContext;

    @GetMapping("/document-types")
    public ApiResponse<List<WalletDocumentTypeDto>> activeTypes() {
        return ApiResponse.success(typeService.listActive().stream().map(mapper::toTypeDto).toList());
    }

    @GetMapping("/documents")
    public ApiResponse<List<WalletDocumentSummaryDto>> list(
            @RequestParam(required = false) String typeId,
            @RequestParam(required = false) String q) {
        return ApiResponse.success(documentService.list(userContext.userId(), typeId, q));
    }

    @GetMapping("/documents/{id}")
    public ApiResponse<WalletDocumentDto> get(@PathVariable String id) {
        return ApiResponse.success(documentService.get(userContext.userId(), id));
    }

    @PostMapping(value = "/documents", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<WalletDocumentDto> create(
            @RequestParam("file") MultipartFile file,
            @RequestParam String typeId,
            @RequestParam(required = false) String label,
            @RequestParam(required = false) String number,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate issueDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate expiryDate,
            @RequestParam(required = false) String notes) {
        WalletDocumentDto dto = documentService.create(userContext.userId(), file, typeId, label, number,
                issueDate, expiryDate, notes);
        return ApiResponse.success("Document added", dto);
    }

    @PutMapping("/documents/{id}")
    public ApiResponse<WalletDocumentDto> update(@PathVariable String id,
                                                 @Valid @RequestBody UpdateDocumentRequest req) {
        return ApiResponse.success("Document updated", documentService.update(userContext.userId(), id, req));
    }

    @DeleteMapping("/documents/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) {
        documentService.delete(userContext.userId(), id);
        return ApiResponse.success("Document deleted");
    }

    @GetMapping("/documents/{id}/content")
    public void content(@PathVariable String id,
                        @RequestParam(defaultValue = "inline") String disposition,
                        HttpServletResponse response) {
        WalletContent content = documentService.loadContent(userContext.userId(), id);
        WalletContentWriter.write(response, content, !"attachment".equalsIgnoreCase(disposition));
    }
}
