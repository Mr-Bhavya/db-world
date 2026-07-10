package com.db.dbworld.app.wallet.dto;

public record WalletDocumentTypeDto(String id, String code, String displayName, String description,
                                    String iconKey, boolean requiresNumber, String numberLabel,
                                    boolean active, int sortOrder) {}
