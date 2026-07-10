package com.db.dbworld.app.wallet.service;

import com.db.dbworld.app.wallet.crypto.WalletFileCryptor;
import com.db.dbworld.config.AppProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class WalletStorageServiceTest {

    @TempDir Path dataRoot;
    WalletStorageService storage;

    @BeforeEach
    void setUp() {
        byte[] key = new byte[32];
        for (int i = 0; i < 32; i++) key[i] = (byte) (i + 7);
        WalletFileCryptor cryptor = new WalletFileCryptor(Base64.getEncoder().encodeToString(key), "");
        AppProperties props = mock(AppProperties.class);
        when(props.getDataPath()).thenReturn(dataRoot);
        storage = new WalletStorageService(props, cryptor);
    }

    @Test
    void storeThenLoad_roundTrips_andFileOnDiskIsEncrypted() throws Exception {
        byte[] plain = "PAN ABCDE1234F".getBytes(StandardCharsets.UTF_8);
        storage.store(9L, "doc-1.enc", plain);

        Path onDisk = dataRoot.resolve("wallet").resolve("9").resolve("doc-1.enc");
        assertThat(onDisk).exists();
        assertThat(java.nio.file.Files.readAllBytes(onDisk)).isNotEqualTo(plain); // encrypted at rest
        assertThat(storage.load(9L, "doc-1.enc")).isEqualTo(plain);
    }

    @Test
    void resolve_rejectsTraversal() {
        assertThatThrownBy(() -> storage.resolve(9L, "../../etc/passwd"))
                .isInstanceOf(SecurityException.class);
    }

    @Test
    void delete_removesFile() {
        storage.store(3L, "d.enc", "x".getBytes(StandardCharsets.UTF_8));
        storage.delete(3L, "d.enc");
        assertThat(dataRoot.resolve("wallet").resolve("3").resolve("d.enc")).doesNotExist();
    }
}
