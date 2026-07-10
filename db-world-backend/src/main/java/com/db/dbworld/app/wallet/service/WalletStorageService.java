package com.db.dbworld.app.wallet.service;

import com.db.dbworld.app.wallet.crypto.WalletFileCryptor;
import com.db.dbworld.config.AppProperties;
import com.db.dbworld.core.exception.DbWorldException;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

@Log4j2
@Service
@RequiredArgsConstructor
public class WalletStorageService {

    private final AppProperties appProperties;
    private final WalletFileCryptor cryptor;

    private Path walletRoot() {
        return appProperties.getDataPath().toAbsolutePath().normalize().resolve("wallet");
    }

    /** Jailed absolute path for {userId}/{fileName}; rejects traversal. */
    Path resolve(Long userId, String fileName) {
        Path base = walletRoot().resolve(String.valueOf(userId)).normalize();
        Path resolved = base.resolve(fileName).normalize();
        if (!resolved.startsWith(base)) {
            log.warn("Wallet path traversal blocked: userId={} name={}", userId, fileName);
            throw new SecurityException("Path traversal blocked");
        }
        return resolved;
    }

    public String store(Long userId, String storedFileName, byte[] plain) {
        Path dest = resolve(userId, storedFileName);
        try {
            Files.createDirectories(dest.getParent());
            Files.write(dest, cryptor.encryptBytes(plain));
            return storedFileName;
        } catch (IOException e) {
            throw new DbWorldException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to store document", e);
        }
    }

    public byte[] load(Long userId, String storedFileName) {
        Path src = resolve(userId, storedFileName);
        try {
            if (!Files.isRegularFile(src)) {
                throw new DbWorldException(HttpStatus.NOT_FOUND, "Document file not found");
            }
            return cryptor.decryptBytes(Files.readAllBytes(src));
        } catch (IOException e) {
            throw new DbWorldException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to read document", e);
        }
    }

    public void delete(Long userId, String storedFileName) {
        try {
            Files.deleteIfExists(resolve(userId, storedFileName));
        } catch (IOException e) {
            log.warn("Failed to delete wallet file userId={} name={}", userId, storedFileName, e);
        }
    }
}
