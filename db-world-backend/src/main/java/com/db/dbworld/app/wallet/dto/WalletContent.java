package com.db.dbworld.app.wallet.dto;

// decrypted bytes ready to stream to a client
public record WalletContent(String fileName, String contentType, byte[] data) {}
