package com.db.dbworld.app.wallet.dto;

import java.util.List;

public record WalletStatsDto(long totalDocuments, long totalStorageBytes, long activeShares,
                             List<TypeCount> perType) {
    public record TypeCount(String typeId, String typeCode, String displayName, long count) {}
}
