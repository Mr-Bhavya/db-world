package com.db.dbworld.app.wallet.controller;

import com.db.dbworld.app.wallet.dto.*;
import com.db.dbworld.app.wallet.mapper.WalletMapper;
import com.db.dbworld.app.wallet.service.WalletDocumentService;
import com.db.dbworld.app.wallet.service.WalletTypeService;
import com.db.dbworld.core.context.UserContext;
import com.db.dbworld.core.exception.DbWorldException;
import com.db.dbworld.core.role.annotations.AnyRole;
import com.db.dbworld.payloads.ApiResponse;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.util.Base64;
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
            @RequestParam(required = false) String notes,
            @RequestParam(required = false) String holder) {
        WalletDocumentDto dto = documentService.create(userContext.userId(), file, typeId, label, number,
                issueDate, expiryDate, notes, holder);
        return ApiResponse.success("Document added", dto);
    }

    /**
     * Base64/JSON create — native clients must use this: CapacitorHttp corrupts binary multipart
     * bodies, so the file rides as base64 (ASCII-safe). Reuses the multipart create logic verbatim.
     */
    @PostMapping(value = "/documents/base64", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ApiResponse<WalletDocumentDto> createBase64(@Valid @RequestBody CreateDocumentBase64Request req) {
        MultipartFile file = new Base64MultipartFile(decodeBase64(req.fileBase64()), req.fileName(), req.contentType());
        WalletDocumentDto dto = documentService.create(userContext.userId(), file, req.typeId(), req.label(),
                req.number(), req.issueDate(), req.expiryDate(), req.notes(), req.holder());
        return ApiResponse.success("Document added", dto);
    }

    @PutMapping("/documents/{id}")
    public ApiResponse<WalletDocumentDto> update(@PathVariable String id,
                                                 @Valid @RequestBody UpdateDocumentRequest req) {
        return ApiResponse.success("Document updated", documentService.update(userContext.userId(), id, req));
    }

    @PutMapping(value = "/documents/{id}/file", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<WalletDocumentDto> replaceFile(@PathVariable String id,
                                                      @RequestParam("file") MultipartFile file) {
        return ApiResponse.success("File updated", documentService.replaceFile(userContext.userId(), id, file));
    }

    /** Base64/JSON file replace — native counterpart of {@link #replaceFile} (see createBase64). */
    @PutMapping(value = "/documents/{id}/file/base64", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ApiResponse<WalletDocumentDto> replaceFileBase64(@PathVariable String id,
                                                            @Valid @RequestBody ReplaceFileBase64Request req) {
        MultipartFile file = new Base64MultipartFile(decodeBase64(req.fileBase64()), req.fileName(), req.contentType());
        return ApiResponse.success("File updated", documentService.replaceFile(userContext.userId(), id, file));
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

    @GetMapping("/documents/{id}/thumbnail")
    public void thumbnail(@PathVariable String id, HttpServletResponse response) {
        WalletContentWriter.write(response, documentService.loadThumbnail(userContext.userId(), id), true);
    }

    private static byte[] decodeBase64(String base64) {
        try {
            return Base64.getDecoder().decode(base64);
        } catch (IllegalArgumentException e) {
            throw new DbWorldException(HttpStatus.BAD_REQUEST, "Invalid file data");
        }
    }
}
