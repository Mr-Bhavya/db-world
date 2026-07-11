package com.db.dbworld.app.wallet.mapper;

import com.db.dbworld.app.wallet.dto.*;
import com.db.dbworld.app.wallet.entity.WalletDocumentEntity;
import com.db.dbworld.app.wallet.entity.WalletDocumentTypeEntity;
import com.db.dbworld.app.wallet.entity.WalletShareEntity;
import org.springframework.stereotype.Component;

@Component
public class WalletMapper {

    public static String mask(String number) {
        if (number == null || number.isBlank()) return null;
        String digits = number.replaceAll("\\s+", "");
        if (digits.length() <= 4) return "••••";
        return "•••• " + digits.substring(digits.length() - 4);
    }

    public WalletDocumentTypeDto toTypeDto(WalletDocumentTypeEntity e) {
        return new WalletDocumentTypeDto(e.getId(), e.getCode(), e.getDisplayName(), e.getDescription(),
                e.getIconKey(), e.isRequiresNumber(), e.getNumberLabel(), e.isActive(), e.getSortOrder());
    }

    public WalletDocumentSummaryDto toSummary(WalletDocumentEntity e, WalletDocumentTypeEntity type, boolean shared) {
        return new WalletDocumentSummaryDto(e.getId(), e.getDocumentTypeId(),
                type != null ? type.getCode() : null,
                type != null ? type.getDisplayName() : null,
                e.getLabel(), mask(e.getDocumentNumber()), e.getIssueDate(), e.getExpiryDate(),
                e.getContentType(), e.getFileSize(), e.getCreatedAt(), e.getUpdatedAt(), shared);
    }

    public WalletDocumentDto toDetail(WalletDocumentEntity e, WalletDocumentTypeEntity type) {
        return new WalletDocumentDto(e.getId(), e.getDocumentTypeId(),
                type != null ? type.getCode() : null,
                type != null ? type.getDisplayName() : null,
                e.getLabel(), e.getDocumentNumber(), e.getIssueDate(), e.getExpiryDate(), e.getNotes(),
                e.getOriginalFileName(), e.getContentType(), e.getFileSize(),
                e.getCreatedAt(), e.getUpdatedAt());
    }

    public ShareDto toShareDto(WalletShareEntity e, String token) {
        return new ShareDto(e.getId(), e.getDocumentId(), e.getExpiresAt(), e.getMaxAccessCount(),
                e.getAccessCount(), e.isRevoked(), e.getCreatedAt(), token);
    }
}
