package com.db.dbworld.app.wallet.dto;

public record WalletDocumentTypeDto(String id, String code, String displayName, String description,
                                    String iconKey, String category, boolean requiresNumber,
                                    String numberLabel, Boolean hasExpiry, boolean active,
                                    int sortOrder) {}
