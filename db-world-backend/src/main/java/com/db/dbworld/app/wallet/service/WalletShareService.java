package com.db.dbworld.app.wallet.service;

import com.db.dbworld.app.wallet.dto.*;
import com.db.dbworld.app.wallet.entity.WalletDocumentEntity;
import com.db.dbworld.app.wallet.entity.WalletDocumentTypeEntity;
import com.db.dbworld.app.wallet.entity.WalletShareEntity;
import com.db.dbworld.app.wallet.mapper.WalletMapper;
import com.db.dbworld.app.wallet.repository.WalletDocumentRepository;
import com.db.dbworld.app.wallet.repository.WalletShareRepository;
import com.db.dbworld.core.exception.DbWorldException;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;

@Log4j2
@Service
@RequiredArgsConstructor
public class WalletShareService {

    private final WalletShareRepository shareRepo;
    private final WalletDocumentRepository docRepo;
    private final WalletDocumentService documentService;
    private final WalletStorageService storage;
    private final WalletTypeService typeService;
    private final WalletMapper mapper;

    private final SecureRandom random = new SecureRandom();

    public ShareDto create(Long userId, String documentId, CreateShareRequest req) {
        documentService.getOwnedEntity(userId, documentId); // 404 if not owner
        String rawToken = randomToken();
        WalletShareEntity e = new WalletShareEntity();
        e.setDocumentId(documentId);
        e.setCreatedByUserId(userId);
        e.setTokenHash(sha256Hex(rawToken));
        e.setExpiresAt(Instant.now().plus(req.expiresInHours(), ChronoUnit.HOURS));
        e.setMaxAccessCount(req.maxAccessCount());
        WalletShareEntity saved = shareRepo.save(e);
        log.info("Wallet share {} created for document {} by user {}", saved.getId(), documentId, userId);
        return mapper.toShareDto(saved, rawToken); // raw token returned once
    }

    public List<ShareDto> listForDocument(Long userId, String documentId) {
        documentService.getOwnedEntity(userId, documentId);
        return shareRepo.findByDocumentIdAndRevokedFalse(documentId).stream()
                .filter(s -> s.getExpiresAt().isAfter(Instant.now()))
                .map(s -> mapper.toShareDto(s, null))
                .toList();
    }

    public void revoke(Long userId, String shareId) {
        WalletShareEntity s = shareRepo.findById(shareId)
                .orElseThrow(() -> new DbWorldException(HttpStatus.NOT_FOUND, "Share not found"));
        documentService.getOwnedEntity(userId, s.getDocumentId()); // ownership check
        s.setRevoked(true);
        shareRepo.save(s);
    }

    public SharedDocumentInfoDto resolveInfo(String rawToken) {
        WalletShareEntity share = validShare(sha256Hex(rawToken));
        WalletDocumentEntity doc = loadDoc(share.getDocumentId());
        WalletDocumentTypeEntity type = typeService.byId().get(doc.getDocumentTypeId());
        return new SharedDocumentInfoDto(doc.getLabel(),
                type != null ? type.getDisplayName() : null,
                doc.getOriginalFileName(), doc.getContentType(), doc.getFileSize());
    }

    public WalletContent resolveContent(String rawToken) {
        return resolveContentByHash(sha256Hex(rawToken));
    }

    // package-private seam so tests can exercise validation without reversing SHA-256
    WalletContent resolveContentByHashForTest(String tokenHash) { return resolveContentByHash(tokenHash); }

    private WalletContent resolveContentByHash(String tokenHash) {
        WalletShareEntity share = validShare(tokenHash);
        WalletDocumentEntity doc = loadDoc(share.getDocumentId());
        share.setAccessCount(share.getAccessCount() + 1);
        shareRepo.save(share);
        log.info("Shared document {} accessed via share {} (count={})",
                doc.getId(), share.getId(), share.getAccessCount());
        return new WalletContent(doc.getOriginalFileName(), doc.getContentType(),
                storage.load(doc.getUserId(), doc.getStoredFileName()));
    }

    private WalletShareEntity validShare(String tokenHash) {
        WalletShareEntity share = shareRepo.findByTokenHash(tokenHash)
                .orElseThrow(() -> new DbWorldException(HttpStatus.NOT_FOUND, "Share link is invalid"));
        if (share.isRevoked()) {
            throw new DbWorldException(HttpStatus.GONE, "Share link has been revoked");
        }
        if (share.getExpiresAt().isBefore(Instant.now())) {
            throw new DbWorldException(HttpStatus.GONE, "Share link has expired");
        }
        if (share.getMaxAccessCount() != null && share.getAccessCount() >= share.getMaxAccessCount()) {
            throw new DbWorldException(HttpStatus.GONE, "Share link has reached its view limit");
        }
        return share;
    }

    private WalletDocumentEntity loadDoc(String documentId) {
        return docRepo.findById(documentId)
                .orElseThrow(() -> new DbWorldException(HttpStatus.NOT_FOUND, "Document no longer exists"));
    }

    private String randomToken() {
        byte[] b = new byte[32];
        random.nextBytes(b);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(b);
    }

    private static String sha256Hex(String s) {
        try {
            byte[] h = MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(h);
        } catch (Exception e) {
            throw new DbWorldException(HttpStatus.INTERNAL_SERVER_ERROR, "Hashing failed", e);
        }
    }
}
