package com.db.dbworld.app.wallet.dto;

public record SharedDocumentInfoDto(String label, String typeDisplayName, String originalFileName,
                                    String contentType, long fileSize) {}
