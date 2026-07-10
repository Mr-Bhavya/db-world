package com.db.dbworld.app.wallet.service;

import com.db.dbworld.app.wallet.dto.WalletStatsDto;
import com.db.dbworld.app.wallet.entity.WalletDocumentTypeEntity;
import com.db.dbworld.app.wallet.repository.WalletDocumentRepository;
import com.db.dbworld.app.wallet.repository.WalletShareRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class WalletStatsService {

    private final WalletDocumentRepository docRepo;
    private final WalletShareRepository shareRepo;
    private final WalletTypeService typeService;

    public WalletStatsDto stats() {
        Map<String, WalletDocumentTypeEntity> types = typeService.byId();
        List<WalletStatsDto.TypeCount> perType = docRepo.countGroupedByType().stream()
                .map(row -> {
                    String typeId = (String) row[0];
                    long count = ((Number) row[1]).longValue();
                    WalletDocumentTypeEntity t = types.get(typeId);
                    return new WalletStatsDto.TypeCount(typeId,
                            t != null ? t.getCode() : "UNKNOWN",
                            t != null ? t.getDisplayName() : "(deleted type)", count);
                })
                .toList();
        return new WalletStatsDto(docRepo.count(), docRepo.totalStorageBytes(),
                shareRepo.countByRevokedFalseAndExpiresAtAfter(Instant.now()), perType);
    }
}
