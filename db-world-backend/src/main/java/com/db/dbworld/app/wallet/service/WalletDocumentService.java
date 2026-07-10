package com.db.dbworld.app.wallet.service;

import com.db.dbworld.app.admin.config.registry.ConfigKeys;
import com.db.dbworld.app.admin.config.service.SettingsService;
import com.db.dbworld.app.wallet.dto.*;
import com.db.dbworld.app.wallet.entity.WalletDocumentEntity;
import com.db.dbworld.app.wallet.entity.WalletDocumentTypeEntity;
import com.db.dbworld.app.wallet.mapper.WalletMapper;
import com.db.dbworld.app.wallet.repository.WalletDocumentRepository;
import com.db.dbworld.app.wallet.repository.WalletShareRepository;
import com.db.dbworld.core.exception.DbWorldException;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Log4j2
@Service
@RequiredArgsConstructor
public class WalletDocumentService {

    private final WalletDocumentRepository docRepo;
    private final WalletShareRepository shareRepo;
    private final WalletTypeService typeService;
    private final WalletStorageService storage;
    private final SettingsService settings;
    private final WalletMapper mapper;

    public List<WalletDocumentSummaryDto> list(Long userId, String typeId, String q) {
        List<WalletDocumentEntity> docs = (typeId == null || typeId.isBlank())
                ? docRepo.findByUserIdOrderByCreatedAtDesc(userId)
                : docRepo.findByUserIdAndDocumentTypeIdOrderByCreatedAtDesc(userId, typeId);
        Map<String, WalletDocumentTypeEntity> types = typeService.byId();
        String needle = q == null ? null : q.trim().toLowerCase();
        return docs.stream()
                .filter(d -> needle == null || needle.isEmpty()
                        || d.getLabel().toLowerCase().contains(needle))
                .map(d -> mapper.toSummary(d, types.get(d.getDocumentTypeId())))
                .toList();
    }

    public WalletDocumentDto get(Long userId, String id) {
        WalletDocumentEntity e = getOwnedEntity(userId, id);
        return mapper.toDetail(e, typeService.byId().get(e.getDocumentTypeId()));
    }

    public WalletDocumentEntity getOwnedEntity(Long userId, String id) {
        return docRepo.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new DbWorldException(HttpStatus.NOT_FOUND, "Document not found"));
    }

    public WalletDocumentDto create(Long userId, MultipartFile file, String typeId, String label,
                                    String number, LocalDate issueDate, LocalDate expiryDate, String notes) {
        if (file == null || file.isEmpty()) {
            throw new DbWorldException(HttpStatus.BAD_REQUEST, "A file is required");
        }
        WalletDocumentTypeEntity type = typeService.get(typeId);
        if (!type.isActive()) {
            throw new DbWorldException(HttpStatus.BAD_REQUEST, "Document type is not active");
        }
        long maxSize = settings.getLong(ConfigKeys.WALLET_MAX_FILE_SIZE_BYTES);
        if (file.getSize() > maxSize) {
            throw new DbWorldException(HttpStatus.BAD_REQUEST, "File exceeds the maximum size of " + maxSize + " bytes");
        }
        String contentType = normalizeType(file.getContentType());
        if (!allowedTypes().contains(contentType)) {
            throw new DbWorldException(HttpStatus.BAD_REQUEST, "Unsupported file type: " + contentType);
        }
        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            throw new DbWorldException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to read upload", e);
        }
        if (bytes.length > maxSize) {
            throw new DbWorldException(HttpStatus.BAD_REQUEST, "File exceeds the maximum size of " + maxSize + " bytes");
        }
        validateMagic(bytes, contentType);

        String storedFileName = UUID.randomUUID() + ".enc";
        storage.store(userId, storedFileName, bytes);

        WalletDocumentEntity e = new WalletDocumentEntity();
        e.setUserId(userId);
        e.setDocumentTypeId(type.getId());
        e.setLabel(label == null || label.isBlank() ? type.getDisplayName() : label.trim());
        e.setDocumentNumber(blankToNull(number));
        e.setIssueDate(issueDate);
        e.setExpiryDate(expiryDate);
        e.setNotes(blankToNull(notes));
        e.setOriginalFileName(safeName(file.getOriginalFilename()));
        e.setContentType(contentType);
        e.setFileSize(bytes.length);
        e.setStoredFileName(storedFileName);
        WalletDocumentEntity saved = docRepo.save(e);
        log.info("Wallet document {} created for user {}", saved.getId(), userId);
        return mapper.toDetail(saved, type);
    }

    public WalletDocumentDto update(Long userId, String id, UpdateDocumentRequest req) {
        WalletDocumentEntity e = getOwnedEntity(userId, id);
        e.setLabel(req.label().trim());
        e.setDocumentNumber(blankToNull(req.documentNumber()));
        e.setIssueDate(req.issueDate());
        e.setExpiryDate(req.expiryDate());
        e.setNotes(blankToNull(req.notes()));
        WalletDocumentEntity saved = docRepo.save(e);
        return mapper.toDetail(saved, typeService.byId().get(saved.getDocumentTypeId()));
    }

    @Transactional
    public void delete(Long userId, String id) {
        WalletDocumentEntity e = getOwnedEntity(userId, id);
        shareRepo.deleteByDocumentId(e.getId());
        storage.delete(userId, e.getStoredFileName());
        docRepo.delete(e);
        log.info("Wallet document {} deleted for user {}", id, userId);
    }

    public WalletContent loadContent(Long userId, String id) {
        WalletDocumentEntity e = getOwnedEntity(userId, id);
        return new WalletContent(e.getOriginalFileName(), e.getContentType(),
                storage.load(userId, e.getStoredFileName()));
    }

    // ---- helpers ----
    private Set<String> allowedTypes() {
        String csv = settings.getString(ConfigKeys.WALLET_ALLOWED_CONTENT_TYPES);
        return Arrays.stream(csv.split(","))
                .map(s -> s.trim().toLowerCase())
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toSet());
    }

    private static String normalizeType(String raw) {
        if (raw == null) return "application/octet-stream";
        int semi = raw.indexOf(';');
        return (semi >= 0 ? raw.substring(0, semi) : raw).trim().toLowerCase();
    }

    private static void validateMagic(byte[] b, String contentType) {
        boolean ok = switch (contentType) {
            case "application/pdf" -> startsWith(b, new byte[]{'%', 'P', 'D', 'F'});
            case "image/png"       -> startsWith(b, new byte[]{(byte) 0x89, 'P', 'N', 'G'});
            case "image/jpeg"      -> b.length > 2 && (b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8;
            default                -> false;
        };
        if (!ok) {
            throw new DbWorldException(HttpStatus.BAD_REQUEST, "File content does not match its type " + contentType);
        }
    }

    private static boolean startsWith(byte[] data, byte[] prefix) {
        if (data.length < prefix.length) return false;
        for (int i = 0; i < prefix.length; i++) if (data[i] != prefix[i]) return false;
        return true;
    }

    private static String blankToNull(String s) { return (s == null || s.isBlank()) ? null : s.trim(); }

    private static String safeName(String original) {
        if (original == null || original.isBlank()) return "document";
        return Path.of(original).getFileName().toString();
    }
}
