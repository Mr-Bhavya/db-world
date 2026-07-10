# Document Wallet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-user, encrypted Document Wallet to db-world where a logged-in user can add / list / preview / download / edit / delete / share government documents (Aadhaar, PAN, licence…), with admin-managed document types and aggregate-only monitoring.

**Architecture:** New backend module `com.db.dbworld.app.wallet` mirroring `app.pm` (password manager) for structure and `app.filemanager` for upload/streaming. File bytes are AES-GCM encrypted at rest via a new `WalletFileCryptor`; ID number and notes are column-encrypted via the existing `StringCryptoConverter`. Frontend feature `src/features/wallet/` (user) + `src/features/admin/wallet/` (admin), built on the AdminV2 stack (TanStack Query, RHF+Zod, MUI, `useT()`, Notistack). Max-size / allowed-types settings plug into the merged `app_config` / `SettingsService` surface.

**Tech Stack:** Spring Boot 4.0.6 (Java 25, WAR), Spring Data JPA + MySQL (`ddl-auto=update`), Lombok, MapStruct 1.6.3 (not needed — hand-written mappers used), JUnit 5 + Mockito + AssertJ. React 18 + Vite, MUI v7 + `@mui/x-charts` v8, TanStack Query v5, React Hook Form + Zod v4, Notistack, Capacitor (Android).

## Global Constraints

- **Branch:** all work on `feat/document-wallet` (already created off `development`). Do not commit to `development`.
- **Spec:** `docs/superpowers/specs/2026-07-10-document-wallet-design.md` is the source of truth.
- **Backend build:** JDK 25 required. Use the Maven wrapper at
  `C:/Users/bhavya.dudhia/.m2/wrapper/dists/apache-maven-3.9.4-bin/2vqnav6ufo1qvo5j2um40861m/apache-maven-3.9.4/bin/mvn`.
  Set `JAVA_HOME` to a JDK 25 install for compile/test. Example (bash):
  `MVN="C:/Users/bhavya.dudhia/.m2/wrapper/dists/apache-maven-3.9.4-bin/2vqnav6ufo1qvo5j2um40861m/apache-maven-3.9.4/bin/mvn"` then `cd db-world-backend && "$MVN" -q test`.
- **Response envelope:** import `com.db.dbworld.payloads.ApiResponse` (the class `GlobalExceptionHandler` and pm/filemanager use). Return `ApiResponse<T>` directly (not `ResponseEntity`).
- **Client errors:** throw `new DbWorldException(HttpStatus.BAD_REQUEST|NOT_FOUND|..., "message")`. Never rely on plain `IllegalArgumentException` for a 4xx (it maps to 500). `SecurityException` → 403 and `NoSuchFileException` → 404 are handled globally.
- **Current user:** inject `com.db.dbworld.core.context.UserContext`; owner key = `userContext.userId()` (returns `Long`).
- **Auth annotations:** `@com.db.dbworld.core.role.annotations.AnyRole` on all user wallet endpoints; `@AdminAccess` on admin endpoints. Public share endpoints must be added to `AppConstants.PUBLIC_APIS`.
- **Entities:** `schema = "db_world"`, `@Id @GeneratedValue(strategy = GenerationType.UUID) @Column(length = 36) String id`, timestamps `@CreationTimestamp`/`@UpdateTimestamp` with `java.time.Instant`, Lombok `@Getter @Setter @NoArgsConstructor` (+`@AllArgsConstructor @Builder` where built fluently). Name and comment indexes explicitly. No schema migrations — `ddl-auto=update` creates tables.
- **Backend tests:** pure JUnit 5 (`org.junit.jupiter.api`) + Mockito `mock(...)` in `@BeforeEach` + AssertJ `assertThat`/`assertThatThrownBy`. No `@SpringBootTest`, no `@DataJpaTest`, no H2 — repositories are mocked.
- **Frontend:** import the shared axios as `import axiosInstance from '@shared/components/ui/utils/AxiosInstants'`; api modules unwrap `res.data.data`. Theme via `import { useT } from '@shared/theme'`. Route constants require BOTH a named `export const` AND an entry in the default-export object in `src/shared/constants/index.js`. No frontend test harness exists (only `vitest` is installed, no jsdom/testing-library) — frontend verification is manual via the browser preview tools, not automated tests.
- **DRY / YAGNI / TDD / frequent commits.** Commit after each task.

---

## File Structure

**Backend — `db-world-backend/src/main/java/com/db/dbworld/app/wallet/`**
- `crypto/WalletFileCryptor.java` — AES-GCM byte encrypt/decrypt (key from `WALLET_ENCRYPTION_KEY`).
- `service/WalletStorageService.java` — per-user jailed path + encrypted read/write/delete.
- `entity/WalletDocumentTypeEntity.java`, `WalletDocumentEntity.java`, `WalletShareEntity.java`.
- `repository/WalletDocumentTypeRepository.java`, `WalletDocumentRepository.java`, `WalletShareRepository.java`.
- `dto/` — records: `WalletDocumentTypeDto`, `UpsertDocumentTypeRequest`, `WalletDocumentSummaryDto`, `WalletDocumentDto`, `UpdateDocumentRequest`, `ShareDto`, `CreateShareRequest`, `SharedDocumentInfoDto`, `WalletStatsDto`.
- `mapper/WalletMapper.java` — hand-written entity↔DTO + masking.
- `service/WalletTypeService.java` (+ seeding), `WalletDocumentService.java`, `WalletShareService.java`, `WalletStatsService.java`.
- `controller/WalletDocumentController.java`, `WalletShareController.java`, `WalletSharePublicController.java`, `WalletAdminController.java`.
- Config keys added to `app/admin/config/registry/ConfigKeys.java` + `SettingsCatalog.java`.
- `AppConstants.PUBLIC_APIS` gets `/api/wallet/shared/**`.

**Backend tests — `db-world-backend/src/test/java/com/db/dbworld/app/wallet/`**
- `crypto/WalletFileCryptorTest.java`, `service/WalletStorageServiceTest.java`, `service/WalletTypeServiceTest.java`, `service/WalletDocumentServiceTest.java`, `service/WalletShareServiceTest.java`.
- Modify `app/admin/config/service/SettingsServiceTest.java` (row-count assertion 23 → 25).

**Frontend — `db-world-frontend/src/features/wallet/`** and **`src/features/admin/wallet/`** (files listed in Phase 7–8). Plus edits to `src/shared/constants/index.js`, `src/app/App.jsx`, `src/shared/components/layout/home/homeData.jsx`, `src/features/admin/layout/AdminLayout.jsx`.

---

## Phase 0 — Config keys

### Task 0.1: Add wallet settings to the config catalog

**Files:**
- Modify: `db-world-backend/src/main/java/com/db/dbworld/app/admin/config/registry/ConfigKeys.java`
- Modify: `db-world-backend/src/main/java/com/db/dbworld/app/admin/config/registry/SettingsCatalog.java`
- Test: `db-world-backend/src/test/java/com/db/dbworld/app/admin/config/service/SettingsServiceTest.java` (fix existing assertion)

**Interfaces:**
- Produces: `ConfigKeys.WALLET_MAX_FILE_SIZE_BYTES = "wallet.max-file-size-bytes"` (LONG), `ConfigKeys.WALLET_ALLOWED_CONTENT_TYPES = "wallet.allowed-content-types"` (STRING). Read later via `settingsService.getLong(...)` / `getString(...)`.

- [ ] **Step 1: Update the failing row-count test first.** In `SettingsServiceTest.java` find the test asserting the seeded catalog size (currently `23`) and change it to `25` (two keys are being added). If the test method is `seed_populatesCatalogRows_idempotently`, update its `isEqualTo(23)` to `isEqualTo(25)`.

- [ ] **Step 2: Run it to confirm it now fails** (catalog still has 23):
  Run: `cd db-world-backend && "$MVN" -q -Dtest=SettingsServiceTest test`
  Expected: FAIL — `expected 25 but was 23`.

- [ ] **Step 3: Add the two key constants** to `ConfigKeys.java` (alongside the existing `public static final String` constants):
```java
public static final String WALLET_MAX_FILE_SIZE_BYTES  = "wallet.max-file-size-bytes";
public static final String WALLET_ALLOWED_CONTENT_TYPES = "wallet.allowed-content-types";
```

- [ ] **Step 4: Add the catalog category + entries** in `SettingsCatalog.java`. Add a category constant near the other `C_*` constants:
```java
private static final String C_WALLET = "Document Wallet";
```
  and add these two entries to the `ALL` list (the `lng`/`str` static factories are already imported/used in this file):
```java
lng(ConfigKeys.WALLET_MAX_FILE_SIZE_BYTES, C_WALLET, "Max file size (bytes)",
    "Maximum upload size per wallet document.", 10_485_760L, 1_048_576L, 104_857_600L, 0),
str(ConfigKeys.WALLET_ALLOWED_CONTENT_TYPES, C_WALLET, "Allowed content types",
    "Comma-separated MIME types accepted for wallet uploads.",
    "application/pdf,image/png,image/jpeg", false, 1),
```
  (If the file references keys unqualified because of a `static import`, match that style — use `WALLET_MAX_FILE_SIZE_BYTES` without the `ConfigKeys.` prefix.)

- [ ] **Step 5: Run the test to confirm it passes:**
  Run: `cd db-world-backend && "$MVN" -q -Dtest=SettingsServiceTest test`
  Expected: PASS.

- [ ] **Step 6: Commit.**
```bash
git add db-world-backend/src/main/java/com/db/dbworld/app/admin/config/registry/ConfigKeys.java \
        db-world-backend/src/main/java/com/db/dbworld/app/admin/config/registry/SettingsCatalog.java \
        db-world-backend/src/test/java/com/db/dbworld/app/admin/config/service/SettingsServiceTest.java
git commit -m "feat(wallet): register wallet max-size + allowed-types config keys"
```

---

## Phase 1 — Encryption & storage

### Task 1.1: `WalletFileCryptor` (AES-GCM)

**Files:**
- Create: `db-world-backend/src/main/java/com/db/dbworld/app/wallet/crypto/WalletFileCryptor.java`
- Test: `db-world-backend/src/test/java/com/db/dbworld/app/wallet/crypto/WalletFileCryptorTest.java`

**Interfaces:**
- Produces: `WalletFileCryptor` (`@Component`) with `byte[] encryptBytes(byte[] plain)` and `byte[] decryptBytes(byte[] stored)`. On-disk layout `[12-byte IV][ciphertext+16-byte GCM tag]`. Tampered input → `DbWorldException(BAD_REQUEST)`.

- [ ] **Step 1: Write the failing test.** The cryptor needs a key; construct it directly with a base64 32-byte key so the test is self-contained.
```java
package com.db.dbworld.app.wallet.crypto;

import com.db.dbworld.core.exception.DbWorldException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class WalletFileCryptorTest {

    WalletFileCryptor cryptor;

    @BeforeEach
    void setUp() {
        byte[] key = new byte[32];
        for (int i = 0; i < 32; i++) key[i] = (byte) i;
        String b64 = Base64.getEncoder().encodeToString(key);
        cryptor = new WalletFileCryptor(b64, ""); // explicit key, no jasypt fallback
    }

    @Test
    void roundTrip_recoversOriginal() {
        byte[] plain = "Aadhaar 1234 5678 9012".getBytes(StandardCharsets.UTF_8);
        byte[] stored = cryptor.encryptBytes(plain);
        assertThat(stored.length).isGreaterThan(plain.length); // IV + tag overhead
        assertThat(cryptor.decryptBytes(stored)).isEqualTo(plain);
    }

    @Test
    void distinctIv_producesDifferentCiphertext() {
        byte[] plain = "same input".getBytes(StandardCharsets.UTF_8);
        assertThat(cryptor.encryptBytes(plain)).isNotEqualTo(cryptor.encryptBytes(plain));
    }

    @Test
    void tamperedCiphertext_isRejected() {
        byte[] stored = cryptor.encryptBytes("secret".getBytes(StandardCharsets.UTF_8));
        stored[stored.length - 1] ^= 0x01; // flip a bit in the tag
        assertThatThrownBy(() -> cryptor.decryptBytes(stored))
                .isInstanceOf(DbWorldException.class);
    }
}
```

- [ ] **Step 2: Run to verify it fails** (class doesn't exist):
  Run: `cd db-world-backend && "$MVN" -q -Dtest=WalletFileCryptorTest test`
  Expected: compile failure / test error — `WalletFileCryptor` not found.

- [ ] **Step 3: Implement `WalletFileCryptor`.**
```java
package com.db.dbworld.app.wallet.crypto;

import com.db.dbworld.core.exception.DbWorldException;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import javax.crypto.AEADBadTagException;
import javax.crypto.Cipher;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * AES-256-GCM encryption for wallet document blobs.
 * On-disk format: [12-byte random IV][ciphertext + 16-byte GCM auth tag].
 * Uses in-memory doFinal (documents are small, capped by wallet.max-file-size-bytes) so that
 * GCM tamper detection is reliable — CipherInputStream can silently swallow AEADBadTagException.
 */
@Log4j2
@Component
public class WalletFileCryptor {

    private static final String TRANSFORM = "AES/GCM/NoPadding";
    private static final int    IV_BYTES  = 12;
    private static final int    TAG_BITS  = 128;
    private static final byte[] DEV_SALT  = "db-world-wallet-v1".getBytes(StandardCharsets.UTF_8);

    private final SecretKeySpec key;
    private final SecureRandom  random = new SecureRandom();

    public WalletFileCryptor(
            @Value("${wallet.encryption-key:${WALLET_ENCRYPTION_KEY:}}") String base64Key,
            @Value("${jasypt.encryptor.password:${JASYPT_PASSWORD:}}") String jasyptPassword) {
        this.key = resolveKey(base64Key, jasyptPassword);
    }

    private SecretKeySpec resolveKey(String base64Key, String jasyptPassword) {
        if (base64Key != null && !base64Key.isBlank()) {
            byte[] raw = Base64.getDecoder().decode(base64Key.trim());
            if (raw.length != 32) {
                throw new DbWorldException(HttpStatus.INTERNAL_SERVER_ERROR,
                        "WALLET_ENCRYPTION_KEY must decode to 32 bytes, got " + raw.length);
            }
            return new SecretKeySpec(raw, "AES");
        }
        if (jasyptPassword == null || jasyptPassword.isBlank()) {
            throw new DbWorldException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "No wallet encryption key: set WALLET_ENCRYPTION_KEY (base64 32 bytes).");
        }
        log.warn("WALLET_ENCRYPTION_KEY not set; deriving wallet key from JASYPT_PASSWORD via PBKDF2. "
                + "Set a dedicated WALLET_ENCRYPTION_KEY in production.");
        try {
            SecretKeyFactory f = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256");
            byte[] raw = f.generateSecret(new PBEKeySpec(jasyptPassword.toCharArray(), DEV_SALT, 65_536, 256))
                          .getEncoded();
            return new SecretKeySpec(raw, "AES");
        } catch (Exception e) {
            throw new DbWorldException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to derive wallet key", e);
        }
    }

    public byte[] encryptBytes(byte[] plain) {
        try {
            byte[] iv = new byte[IV_BYTES];
            random.nextBytes(iv);
            Cipher cipher = Cipher.getInstance(TRANSFORM);
            cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, iv));
            byte[] ct = cipher.doFinal(plain);
            byte[] out = new byte[IV_BYTES + ct.length];
            System.arraycopy(iv, 0, out, 0, IV_BYTES);
            System.arraycopy(ct, 0, out, IV_BYTES, ct.length);
            return out;
        } catch (Exception e) {
            throw new DbWorldException(HttpStatus.INTERNAL_SERVER_ERROR, "Wallet encryption failed", e);
        }
    }

    public byte[] decryptBytes(byte[] stored) {
        if (stored == null || stored.length <= IV_BYTES) {
            throw new DbWorldException(HttpStatus.BAD_REQUEST, "Corrupt wallet file");
        }
        try {
            Cipher cipher = Cipher.getInstance(TRANSFORM);
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, stored, 0, IV_BYTES));
            return cipher.doFinal(stored, IV_BYTES, stored.length - IV_BYTES);
        } catch (AEADBadTagException e) {
            throw new DbWorldException(HttpStatus.BAD_REQUEST, "Wallet file failed integrity check", e);
        } catch (Exception e) {
            throw new DbWorldException(HttpStatus.INTERNAL_SERVER_ERROR, "Wallet decryption failed", e);
        }
    }
}
```

- [ ] **Step 4: Run the test to verify it passes:**
  Run: `cd db-world-backend && "$MVN" -q -Dtest=WalletFileCryptorTest test`
  Expected: PASS (3 tests).

- [ ] **Step 5: Commit.**
```bash
git add db-world-backend/src/main/java/com/db/dbworld/app/wallet/crypto/WalletFileCryptor.java \
        db-world-backend/src/test/java/com/db/dbworld/app/wallet/crypto/WalletFileCryptorTest.java
git commit -m "feat(wallet): AES-GCM file cryptor with tamper detection"
```

### Task 1.2: `WalletStorageService` (jailed per-user encrypted storage)

**Files:**
- Create: `db-world-backend/src/main/java/com/db/dbworld/app/wallet/service/WalletStorageService.java`
- Test: `db-world-backend/src/test/java/com/db/dbworld/app/wallet/service/WalletStorageServiceTest.java`

**Interfaces:**
- Consumes: `WalletFileCryptor` (Task 1.1), `com.db.dbworld.config.AppProperties` (`getDataPath()` → `Path`).
- Produces:
  - `String store(Long userId, String storedFileName, byte[] plain)` — encrypts + writes `{dataPath}/wallet/{userId}/{storedFileName}`, returns `storedFileName`.
  - `byte[] load(Long userId, String storedFileName)` — reads + decrypts.
  - `void delete(Long userId, String storedFileName)`.
  - package-private `Path resolve(Long userId, String fileName)` — jailed; throws `SecurityException` on traversal.

- [ ] **Step 1: Write the failing test** (mock `AppProperties` to a JUnit `@TempDir`; use a real cryptor with an explicit key):
```java
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
```

- [ ] **Step 2: Run to verify it fails:**
  Run: `cd db-world-backend && "$MVN" -q -Dtest=WalletStorageServiceTest test`
  Expected: FAIL — class not found.

- [ ] **Step 3: Implement `WalletStorageService`.**
```java
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
```

- [ ] **Step 4: Run the test to verify it passes:**
  Run: `cd db-world-backend && "$MVN" -q -Dtest=WalletStorageServiceTest test`
  Expected: PASS (3 tests).

- [ ] **Step 5: Commit.**
```bash
git add db-world-backend/src/main/java/com/db/dbworld/app/wallet/service/WalletStorageService.java \
        db-world-backend/src/test/java/com/db/dbworld/app/wallet/service/WalletStorageServiceTest.java
git commit -m "feat(wallet): per-user jailed encrypted blob storage"
```

---

## Phase 2 — Entities & repositories

### Task 2.1: Document-type entity + repository

**Files:**
- Create: `.../app/wallet/entity/WalletDocumentTypeEntity.java`
- Create: `.../app/wallet/repository/WalletDocumentTypeRepository.java`

**Interfaces:**
- Produces: `WalletDocumentTypeEntity` (fields: `id, code, displayName, description, iconKey, requiresNumber, numberLabel, active, sortOrder, createdAt, updatedAt`); `WalletDocumentTypeRepository` with `findByCode`, `findByActiveTrueOrderBySortOrderAsc`, `findAllByOrderBySortOrderAsc`, `existsByCode`.

- [ ] **Step 1: Create the entity.**
```java
package com.db.dbworld.app.wallet.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

@Entity
@Table(name = "wallet_document_type", schema = "db_world",
        uniqueConstraints = @UniqueConstraint(name = "uk_wallet_type_code", columnNames = "code"))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class WalletDocumentTypeEntity {

    @Id @GeneratedValue(strategy = GenerationType.UUID) @Column(length = 36)
    private String id;

    @Column(nullable = false, length = 40)  private String code;
    @Column(nullable = false, length = 100) private String displayName;
    @Column(length = 300) private String description;
    @Column(length = 40)  private String iconKey;

    @Column(nullable = false) private boolean requiresNumber;
    @Column(length = 60)      private String numberLabel;
    @Column(nullable = false) private boolean active;
    @Column(nullable = false) private int sortOrder;

    @CreationTimestamp @Column(nullable = false, updatable = false) private Instant createdAt;
    @UpdateTimestamp   @Column(nullable = false)                    private Instant updatedAt;
}
```

- [ ] **Step 2: Create the repository.**
```java
package com.db.dbworld.app.wallet.repository;

import com.db.dbworld.app.wallet.entity.WalletDocumentTypeEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface WalletDocumentTypeRepository extends JpaRepository<WalletDocumentTypeEntity, String> {
    Optional<WalletDocumentTypeEntity> findByCode(String code);
    List<WalletDocumentTypeEntity> findByActiveTrueOrderBySortOrderAsc();
    List<WalletDocumentTypeEntity> findAllByOrderBySortOrderAsc();
    boolean existsByCode(String code);
}
```

- [ ] **Step 3: Compile.**
  Run: `cd db-world-backend && "$MVN" -q compile`
  Expected: BUILD SUCCESS.

- [ ] **Step 4: Commit.**
```bash
git add db-world-backend/src/main/java/com/db/dbworld/app/wallet/entity/WalletDocumentTypeEntity.java \
        db-world-backend/src/main/java/com/db/dbworld/app/wallet/repository/WalletDocumentTypeRepository.java
git commit -m "feat(wallet): document-type entity + repository"
```

### Task 2.2: Document entity + repository

**Files:**
- Create: `.../app/wallet/entity/WalletDocumentEntity.java`
- Create: `.../app/wallet/repository/WalletDocumentRepository.java`

**Interfaces:**
- Produces: `WalletDocumentEntity` (fields: `id, userId, documentTypeId, label, documentNumber (encrypted), issueDate, expiryDate, notes (encrypted), originalFileName, contentType, fileSize, storedFileName, createdAt, updatedAt`); `WalletDocumentRepository` with owner-scoped finders + stats aggregates.

- [ ] **Step 1: Create the entity.**
```java
package com.db.dbworld.app.wallet.entity;

import com.db.dbworld.security.crypto.StringCryptoConverter;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "wallet_document", schema = "db_world",
        indexes = {
            // owner lookups (list a user's documents)
            @Index(name = "idx_wallet_doc_user", columnList = "user_id"),
            // owner + type filter
            @Index(name = "idx_wallet_doc_user_type", columnList = "user_id, document_type_id")
        })
@Getter @Setter @NoArgsConstructor
public class WalletDocumentEntity {

    @Id @GeneratedValue(strategy = GenerationType.UUID) @Column(length = 36)
    private String id;

    @Column(name = "user_id", nullable = false) private Long userId;
    @Column(name = "document_type_id", nullable = false, length = 36) private String documentTypeId;
    @Column(nullable = false, length = 150) private String label;

    @Convert(converter = StringCryptoConverter.class)
    @Lob @Column(columnDefinition = "LONGTEXT")
    private String documentNumber;

    private LocalDate issueDate;
    private LocalDate expiryDate;

    @Convert(converter = StringCryptoConverter.class)
    @Lob @Column(columnDefinition = "LONGTEXT")
    private String notes;

    @Column(nullable = false, length = 255) private String originalFileName;
    @Column(nullable = false, length = 100) private String contentType;
    @Column(nullable = false) private long fileSize;
    @Column(nullable = false, length = 120) private String storedFileName;

    @CreationTimestamp @Column(nullable = false, updatable = false) private Instant createdAt;
    @UpdateTimestamp   @Column(nullable = false)                    private Instant updatedAt;
}
```

- [ ] **Step 2: Create the repository.**
```java
package com.db.dbworld.app.wallet.repository;

import com.db.dbworld.app.wallet.entity.WalletDocumentEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface WalletDocumentRepository extends JpaRepository<WalletDocumentEntity, String> {

    List<WalletDocumentEntity> findByUserIdOrderByCreatedAtDesc(Long userId);
    List<WalletDocumentEntity> findByUserIdAndDocumentTypeIdOrderByCreatedAtDesc(Long userId, String documentTypeId);
    Optional<WalletDocumentEntity> findByIdAndUserId(String id, Long userId);

    long countByDocumentTypeId(String documentTypeId);

    @Query("select coalesce(sum(d.fileSize), 0) from WalletDocumentEntity d")
    long totalStorageBytes();

    // rows of [documentTypeId, count] for the admin monitor breakdown
    @Query("select d.documentTypeId, count(d) from WalletDocumentEntity d group by d.documentTypeId")
    List<Object[]> countGroupedByType();
}
```

- [ ] **Step 3: Compile.**
  Run: `cd db-world-backend && "$MVN" -q compile`
  Expected: BUILD SUCCESS.

- [ ] **Step 4: Commit.**
```bash
git add db-world-backend/src/main/java/com/db/dbworld/app/wallet/entity/WalletDocumentEntity.java \
        db-world-backend/src/main/java/com/db/dbworld/app/wallet/repository/WalletDocumentRepository.java
git commit -m "feat(wallet): document entity (encrypted number/notes) + repository"
```

### Task 2.3: Share entity + repository

**Files:**
- Create: `.../app/wallet/entity/WalletShareEntity.java`
- Create: `.../app/wallet/repository/WalletShareRepository.java`

**Interfaces:**
- Produces: `WalletShareEntity` (fields: `id, documentId, createdByUserId, tokenHash, expiresAt, maxAccessCount, accessCount, revoked, createdAt`); `WalletShareRepository` with `findByTokenHash`, `findByDocumentIdAndRevokedFalse`, `countByRevokedFalseAndExpiresAtAfter`, `deleteByDocumentId`.

- [ ] **Step 1: Create the entity.**
```java
package com.db.dbworld.app.wallet.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

@Entity
@Table(name = "wallet_share", schema = "db_world",
        uniqueConstraints = @UniqueConstraint(name = "uk_wallet_share_token", columnNames = "token_hash"),
        indexes = @Index(name = "idx_wallet_share_doc", columnList = "document_id"))
@Getter @Setter @NoArgsConstructor
public class WalletShareEntity {

    @Id @GeneratedValue(strategy = GenerationType.UUID) @Column(length = 36)
    private String id;

    @Column(name = "document_id", nullable = false, length = 36) private String documentId;
    @Column(name = "created_by_user_id", nullable = false) private Long createdByUserId;
    @Column(name = "token_hash", nullable = false, length = 64) private String tokenHash;

    @Column(name = "expires_at", nullable = false) private Instant expiresAt;
    @Column(name = "max_access_count") private Integer maxAccessCount;
    @Column(name = "access_count", nullable = false) private int accessCount;
    @Column(nullable = false) private boolean revoked;

    @CreationTimestamp @Column(nullable = false, updatable = false) private Instant createdAt;
}
```

- [ ] **Step 2: Create the repository.**
```java
package com.db.dbworld.app.wallet.repository;

import com.db.dbworld.app.wallet.entity.WalletShareEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface WalletShareRepository extends JpaRepository<WalletShareEntity, String> {
    Optional<WalletShareEntity> findByTokenHash(String tokenHash);
    List<WalletShareEntity> findByDocumentIdAndRevokedFalse(String documentId);
    long countByRevokedFalseAndExpiresAtAfter(Instant now);

    @Modifying
    @Transactional
    void deleteByDocumentId(String documentId);
}
```

- [ ] **Step 3: Compile.**
  Run: `cd db-world-backend && "$MVN" -q compile`
  Expected: BUILD SUCCESS.

- [ ] **Step 4: Commit.**
```bash
git add db-world-backend/src/main/java/com/db/dbworld/app/wallet/entity/WalletShareEntity.java \
        db-world-backend/src/main/java/com/db/dbworld/app/wallet/repository/WalletShareRepository.java
git commit -m "feat(wallet): share entity + repository"
```

---

## Phase 3 — DTOs, mapper, type service, admin controller

### Task 3.1: DTO records

**Files (create all under `.../app/wallet/dto/`):**

**Interfaces:** Produces the DTO records used by every service/controller below.

- [ ] **Step 1: Create the DTO records.**

`WalletDocumentTypeDto.java`
```java
package com.db.dbworld.app.wallet.dto;

public record WalletDocumentTypeDto(String id, String code, String displayName, String description,
                                    String iconKey, boolean requiresNumber, String numberLabel,
                                    boolean active, int sortOrder) {}
```
`UpsertDocumentTypeRequest.java`
```java
package com.db.dbworld.app.wallet.dto;

import jakarta.validation.constraints.NotBlank;

public record UpsertDocumentTypeRequest(@NotBlank String code, @NotBlank String displayName,
                                        String description, String iconKey, boolean requiresNumber,
                                        String numberLabel, Boolean active, Integer sortOrder) {}
```
`WalletDocumentSummaryDto.java`
```java
package com.db.dbworld.app.wallet.dto;

import java.time.Instant;
import java.time.LocalDate;

public record WalletDocumentSummaryDto(String id, String typeId, String typeCode, String typeDisplayName,
                                       String label, String maskedNumber, LocalDate issueDate,
                                       LocalDate expiryDate, String contentType, long fileSize,
                                       Instant createdAt, Instant updatedAt) {}
```
`WalletDocumentDto.java`
```java
package com.db.dbworld.app.wallet.dto;

import java.time.Instant;
import java.time.LocalDate;

public record WalletDocumentDto(String id, String typeId, String typeCode, String typeDisplayName,
                                String label, String documentNumber, LocalDate issueDate,
                                LocalDate expiryDate, String notes, String originalFileName,
                                String contentType, long fileSize, Instant createdAt, Instant updatedAt) {}
```
`UpdateDocumentRequest.java`
```java
package com.db.dbworld.app.wallet.dto;

import jakarta.validation.constraints.NotBlank;
import java.time.LocalDate;

public record UpdateDocumentRequest(@NotBlank String label, String documentNumber,
                                    LocalDate issueDate, LocalDate expiryDate, String notes) {}
```
`CreateShareRequest.java`
```java
package com.db.dbworld.app.wallet.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

public record CreateShareRequest(@Min(1) @Max(720) int expiresInHours, Integer maxAccessCount) {}
```
`ShareDto.java`
```java
package com.db.dbworld.app.wallet.dto;

import java.time.Instant;

// token is populated only in the create response (shown once); null when listing.
public record ShareDto(String id, String documentId, Instant expiresAt, Integer maxAccessCount,
                       int accessCount, boolean revoked, Instant createdAt, String token) {}
```
`SharedDocumentInfoDto.java`
```java
package com.db.dbworld.app.wallet.dto;

public record SharedDocumentInfoDto(String label, String typeDisplayName, String originalFileName,
                                    String contentType, long fileSize) {}
```
`WalletStatsDto.java`
```java
package com.db.dbworld.app.wallet.dto;

import java.util.List;

public record WalletStatsDto(long totalDocuments, long totalStorageBytes, long activeShares,
                             List<TypeCount> perType) {
    public record TypeCount(String typeId, String typeCode, String displayName, long count) {}
}
```
`WalletContent.java`
```java
package com.db.dbworld.app.wallet.dto;

// decrypted bytes ready to stream to a client
public record WalletContent(String fileName, String contentType, byte[] data) {}
```

- [ ] **Step 2: Compile.** Run: `cd db-world-backend && "$MVN" -q compile` — Expected: BUILD SUCCESS.
- [ ] **Step 3: Commit.**
```bash
git add db-world-backend/src/main/java/com/db/dbworld/app/wallet/dto/
git commit -m "feat(wallet): DTO records"
```

### Task 3.2: `WalletMapper` (+ number masking)

**Files:**
- Create: `.../app/wallet/mapper/WalletMapper.java`
- Test: `.../test/.../app/wallet/mapper/WalletMapperTest.java`

**Interfaces:**
- Produces `WalletMapper` (`@Component`): `WalletDocumentSummaryDto toSummary(WalletDocumentEntity, WalletDocumentTypeEntity)`, `WalletDocumentDto toDetail(WalletDocumentEntity, WalletDocumentTypeEntity)`, `WalletDocumentTypeDto toTypeDto(WalletDocumentTypeEntity)`, `ShareDto toShareDto(WalletShareEntity, String token)`, and `static String mask(String)`.

- [ ] **Step 1: Write the failing test** (mask logic is the only branchy part):
```java
package com.db.dbworld.app.wallet.mapper;

import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class WalletMapperTest {
    @Test void mask_hidesAllButLastFour() {
        assertThat(WalletMapper.mask("1234 5678 9012")).isEqualTo("•••• 9012");
    }
    @Test void mask_shortValue_isFullyHidden() {
        assertThat(WalletMapper.mask("12")).isEqualTo("••••");
    }
    @Test void mask_nullOrBlank_isNull() {
        assertThat(WalletMapper.mask(null)).isNull();
        assertThat(WalletMapper.mask("  ")).isNull();
    }
}
```

- [ ] **Step 2: Run to verify it fails.** Run: `cd db-world-backend && "$MVN" -q -Dtest=WalletMapperTest test` — Expected: FAIL (class not found).

- [ ] **Step 3: Implement `WalletMapper`.**
```java
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

    public WalletDocumentSummaryDto toSummary(WalletDocumentEntity e, WalletDocumentTypeEntity type) {
        return new WalletDocumentSummaryDto(e.getId(), e.getDocumentTypeId(),
                type != null ? type.getCode() : null,
                type != null ? type.getDisplayName() : null,
                e.getLabel(), mask(e.getDocumentNumber()), e.getIssueDate(), e.getExpiryDate(),
                e.getContentType(), e.getFileSize(), e.getCreatedAt(), e.getUpdatedAt());
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
```

- [ ] **Step 4: Run the test to verify it passes.** Run: `cd db-world-backend && "$MVN" -q -Dtest=WalletMapperTest test` — Expected: PASS (3 tests).
- [ ] **Step 5: Commit.**
```bash
git add db-world-backend/src/main/java/com/db/dbworld/app/wallet/mapper/WalletMapper.java \
        db-world-backend/src/test/java/com/db/dbworld/app/wallet/mapper/WalletMapperTest.java
git commit -m "feat(wallet): entity-DTO mapper + number masking"
```

### Task 3.3: `WalletTypeService` (seeding + CRUD)

**Files:**
- Create: `.../app/wallet/service/WalletTypeService.java`
- Test: `.../test/.../app/wallet/service/WalletTypeServiceTest.java`

**Interfaces:**
- Consumes: `WalletDocumentTypeRepository` (2.1), `WalletDocumentRepository` (2.2).
- Produces `WalletTypeService` (`@Service`): `List<WalletDocumentTypeEntity> listActive()`, `listAll()`, `WalletDocumentTypeEntity get(String id)` (404), `create(UpsertDocumentTypeRequest)`, `update(String id, UpsertDocumentTypeRequest)`, `boolean deleteOrDeactivate(String id)` (true=hard-deleted, false=deactivated), `Map<String,WalletDocumentTypeEntity> byId()`. Seeds 6 defaults in `@PostConstruct`.

- [ ] **Step 1: Write the failing test.**
```java
package com.db.dbworld.app.wallet.service;

import com.db.dbworld.app.wallet.dto.UpsertDocumentTypeRequest;
import com.db.dbworld.app.wallet.entity.WalletDocumentTypeEntity;
import com.db.dbworld.app.wallet.repository.WalletDocumentRepository;
import com.db.dbworld.app.wallet.repository.WalletDocumentTypeRepository;
import com.db.dbworld.core.exception.DbWorldException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class WalletTypeServiceTest {

    WalletDocumentTypeRepository typeRepo;
    WalletDocumentRepository docRepo;
    WalletTypeService service;
    Map<String, WalletDocumentTypeEntity> store;

    @BeforeEach
    void setUp() {
        typeRepo = mock(WalletDocumentTypeRepository.class);
        docRepo  = mock(WalletDocumentRepository.class);
        store = new HashMap<>();
        when(typeRepo.findById(any())).thenAnswer(a -> Optional.ofNullable(store.get(a.getArgument(0))));
        when(typeRepo.existsByCode(any())).thenAnswer(a ->
                store.values().stream().anyMatch(t -> t.getCode().equals(a.getArgument(0))));
        when(typeRepo.save(any(WalletDocumentTypeEntity.class))).thenAnswer(a -> {
            WalletDocumentTypeEntity e = a.getArgument(0);
            if (e.getId() == null) e.setId("t-" + (store.size() + 1));
            store.put(e.getId(), e);
            return e;
        });
        service = new WalletTypeService(typeRepo, docRepo);
    }

    @Test
    void create_rejectsDuplicateCode() {
        service.create(new UpsertDocumentTypeRequest("PAN", "PAN Card", null, null, false, null, true, 0));
        assertThatThrownBy(() -> service.create(
                new UpsertDocumentTypeRequest("PAN", "Another", null, null, false, null, true, 1)))
                .isInstanceOf(DbWorldException.class);
    }

    @Test
    void get_missing_throwsNotFound() {
        assertThatThrownBy(() -> service.get("nope")).isInstanceOf(DbWorldException.class);
    }

    @Test
    void deleteOrDeactivate_whenInUse_deactivatesInsteadOfDeleting() {
        WalletDocumentTypeEntity t = service.create(
                new UpsertDocumentTypeRequest("DL", "Driving Licence", null, null, true, "DL No", true, 0));
        when(docRepo.countByDocumentTypeId(t.getId())).thenReturn(2L);

        boolean deleted = service.deleteOrDeactivate(t.getId());

        assertThat(deleted).isFalse();
        assertThat(store.get(t.getId()).isActive()).isFalse();
        verify(typeRepo, never()).deleteById(t.getId());
    }
}
```

- [ ] **Step 2: Run to verify it fails.** Run: `cd db-world-backend && "$MVN" -q -Dtest=WalletTypeServiceTest test` — Expected: FAIL (class not found).

- [ ] **Step 3: Implement `WalletTypeService`.**
```java
package com.db.dbworld.app.wallet.service;

import com.db.dbworld.app.wallet.dto.UpsertDocumentTypeRequest;
import com.db.dbworld.app.wallet.entity.WalletDocumentTypeEntity;
import com.db.dbworld.app.wallet.repository.WalletDocumentRepository;
import com.db.dbworld.app.wallet.repository.WalletDocumentTypeRepository;
import com.db.dbworld.core.exception.DbWorldException;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Log4j2
@Service
@RequiredArgsConstructor
public class WalletTypeService {

    private final WalletDocumentTypeRepository typeRepo;
    private final WalletDocumentRepository docRepo;

    // code, displayName, requiresNumber, numberLabel, sortOrder
    private record Seed(String code, String name, boolean requiresNumber, String numberLabel, int order) {}
    private static final List<Seed> DEFAULTS = List.of(
            new Seed("AADHAAR",         "Aadhaar Card",    true,  "Aadhaar Number", 0),
            new Seed("PAN",             "PAN Card",        true,  "PAN Number",     1),
            new Seed("DRIVING_LICENCE", "Driving Licence", true,  "Licence Number", 2),
            new Seed("PASSPORT",        "Passport",        true,  "Passport Number",3),
            new Seed("VOTER_ID",        "Voter ID",        true,  "EPIC Number",    4),
            new Seed("OTHER",           "Other",           false, null,             5)
    );

    /** Idempotent seed — never overwrites an existing row (mirrors SchedulerAdminService.seedDefaults). */
    @PostConstruct
    void seedDefaults() {
        try {
            for (Seed s : DEFAULTS) {
                if (typeRepo.findByCode(s.code()).isEmpty()) {
                    WalletDocumentTypeEntity e = WalletDocumentTypeEntity.builder()
                            .code(s.code()).displayName(s.name())
                            .requiresNumber(s.requiresNumber()).numberLabel(s.numberLabel())
                            .active(true).sortOrder(s.order())
                            .build();
                    typeRepo.save(e);
                    log.info("Seeded wallet document type {}", s.code());
                }
            }
        } catch (Exception ex) {
            log.warn("Wallet type seeding skipped: {}", ex.getMessage());
        }
    }

    public List<WalletDocumentTypeEntity> listActive() { return typeRepo.findByActiveTrueOrderBySortOrderAsc(); }
    public List<WalletDocumentTypeEntity> listAll()    { return typeRepo.findAllByOrderBySortOrderAsc(); }

    public WalletDocumentTypeEntity get(String id) {
        return typeRepo.findById(id)
                .orElseThrow(() -> new DbWorldException(HttpStatus.NOT_FOUND, "Document type not found"));
    }

    public Map<String, WalletDocumentTypeEntity> byId() {
        return typeRepo.findAll().stream()
                .collect(Collectors.toMap(WalletDocumentTypeEntity::getId, Function.identity()));
    }

    public WalletDocumentTypeEntity create(UpsertDocumentTypeRequest req) {
        String code = req.code().trim().toUpperCase();
        if (typeRepo.existsByCode(code)) {
            throw new DbWorldException(HttpStatus.BAD_REQUEST, "A document type with code " + code + " already exists");
        }
        WalletDocumentTypeEntity e = WalletDocumentTypeEntity.builder()
                .code(code).displayName(req.displayName().trim())
                .description(req.description()).iconKey(req.iconKey())
                .requiresNumber(req.requiresNumber()).numberLabel(req.numberLabel())
                .active(req.active() == null || req.active())
                .sortOrder(req.sortOrder() == null ? 0 : req.sortOrder())
                .build();
        return typeRepo.save(e);
    }

    public WalletDocumentTypeEntity update(String id, UpsertDocumentTypeRequest req) {
        WalletDocumentTypeEntity e = get(id);
        String code = req.code().trim().toUpperCase();
        if (!code.equals(e.getCode()) && typeRepo.existsByCode(code)) {
            throw new DbWorldException(HttpStatus.BAD_REQUEST, "A document type with code " + code + " already exists");
        }
        e.setCode(code);
        e.setDisplayName(req.displayName().trim());
        e.setDescription(req.description());
        e.setIconKey(req.iconKey());
        e.setRequiresNumber(req.requiresNumber());
        e.setNumberLabel(req.numberLabel());
        if (req.active() != null)    e.setActive(req.active());
        if (req.sortOrder() != null) e.setSortOrder(req.sortOrder());
        return typeRepo.save(e);
    }

    /** Hard-deletes if unused; otherwise deactivates. Returns true if hard-deleted. */
    public boolean deleteOrDeactivate(String id) {
        WalletDocumentTypeEntity e = get(id);
        if (docRepo.countByDocumentTypeId(id) > 0) {
            e.setActive(false);
            typeRepo.save(e);
            return false;
        }
        typeRepo.deleteById(id);
        return true;
    }
}
```

- [ ] **Step 4: Run the test to verify it passes.** Run: `cd db-world-backend && "$MVN" -q -Dtest=WalletTypeServiceTest test` — Expected: PASS (3 tests).
- [ ] **Step 5: Commit.**
```bash
git add db-world-backend/src/main/java/com/db/dbworld/app/wallet/service/WalletTypeService.java \
        db-world-backend/src/test/java/com/db/dbworld/app/wallet/service/WalletTypeServiceTest.java
git commit -m "feat(wallet): document-type service with seeding + CRUD"
```

### Task 3.4: `WalletStatsService` + `WalletAdminController`

**Files:**
- Create: `.../app/wallet/service/WalletStatsService.java`
- Create: `.../app/wallet/controller/WalletAdminController.java`

**Interfaces:**
- Consumes: `WalletTypeService` (3.3), `WalletMapper` (3.2), `WalletDocumentRepository`, `WalletShareRepository`.
- Produces: `WalletStatsService.stats() → WalletStatsDto`; admin REST at `/api/admin/wallet`.

- [ ] **Step 1: Implement `WalletStatsService`.**
```java
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
```

- [ ] **Step 2: Implement `WalletAdminController`.**
```java
package com.db.dbworld.app.wallet.controller;

import com.db.dbworld.app.wallet.dto.UpsertDocumentTypeRequest;
import com.db.dbworld.app.wallet.dto.WalletDocumentTypeDto;
import com.db.dbworld.app.wallet.dto.WalletStatsDto;
import com.db.dbworld.app.wallet.mapper.WalletMapper;
import com.db.dbworld.app.wallet.service.WalletStatsService;
import com.db.dbworld.app.wallet.service.WalletTypeService;
import com.db.dbworld.core.role.annotations.AdminAccess;
import com.db.dbworld.payloads.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/wallet")
@RequiredArgsConstructor
@AdminAccess
public class WalletAdminController {

    private final WalletTypeService typeService;
    private final WalletStatsService statsService;
    private final WalletMapper mapper;

    @GetMapping("/types")
    public ApiResponse<List<WalletDocumentTypeDto>> listTypes() {
        return ApiResponse.success(typeService.listAll().stream().map(mapper::toTypeDto).toList());
    }

    @PostMapping("/types")
    public ApiResponse<WalletDocumentTypeDto> createType(@Valid @RequestBody UpsertDocumentTypeRequest req) {
        return ApiResponse.success("Document type created", mapper.toTypeDto(typeService.create(req)));
    }

    @PutMapping("/types/{id}")
    public ApiResponse<WalletDocumentTypeDto> updateType(@PathVariable String id,
                                                         @Valid @RequestBody UpsertDocumentTypeRequest req) {
        return ApiResponse.success("Document type updated", mapper.toTypeDto(typeService.update(id, req)));
    }

    @DeleteMapping("/types/{id}")
    public ApiResponse<Void> deleteType(@PathVariable String id) {
        boolean deleted = typeService.deleteOrDeactivate(id);
        return ApiResponse.success(deleted ? "Document type deleted"
                                            : "Document type is in use — deactivated instead");
    }

    @GetMapping("/stats")
    public ApiResponse<WalletStatsDto> stats() {
        return ApiResponse.success(statsService.stats());
    }
}
```

- [ ] **Step 3: Compile.** Run: `cd db-world-backend && "$MVN" -q compile` — Expected: BUILD SUCCESS.
- [ ] **Step 4: Commit.**
```bash
git add db-world-backend/src/main/java/com/db/dbworld/app/wallet/service/WalletStatsService.java \
        db-world-backend/src/main/java/com/db/dbworld/app/wallet/controller/WalletAdminController.java
git commit -m "feat(wallet): admin controller (types CRUD + aggregate stats)"
```

---

## Phase 4 — Document service & user controller

### Task 4.1: `WalletDocumentService`

**Files:**
- Create: `.../app/wallet/service/WalletDocumentService.java`
- Test: `.../test/.../app/wallet/service/WalletDocumentServiceTest.java`

**Interfaces:**
- Consumes: `WalletDocumentRepository`, `WalletShareRepository`, `WalletTypeService`, `WalletStorageService`, `WalletMapper`, `com.db.dbworld.app.admin.config.service.SettingsService`.
- Produces `WalletDocumentService` (`@Service`):
  - `List<WalletDocumentSummaryDto> list(Long userId, String typeId, String q)`
  - `WalletDocumentDto get(Long userId, String id)` (404 if not owner)
  - `WalletDocumentDto create(Long userId, MultipartFile file, String typeId, String label, String number, LocalDate issueDate, LocalDate expiryDate, String notes)`
  - `WalletDocumentDto update(Long userId, String id, UpdateDocumentRequest req)`
  - `void delete(Long userId, String id)`
  - `WalletContent loadContent(Long userId, String id)`
  - `WalletDocumentEntity getOwnedEntity(Long userId, String id)` (used by share service)

- [ ] **Step 1: Write the failing test** (real mapper; mocked repos/storage/settings/typeService):
```java
package com.db.dbworld.app.wallet.service;

import com.db.dbworld.app.admin.config.service.SettingsService;
import com.db.dbworld.app.wallet.entity.WalletDocumentEntity;
import com.db.dbworld.app.wallet.entity.WalletDocumentTypeEntity;
import com.db.dbworld.app.wallet.mapper.WalletMapper;
import com.db.dbworld.app.wallet.repository.WalletDocumentRepository;
import com.db.dbworld.app.wallet.repository.WalletShareRepository;
import com.db.dbworld.core.exception.DbWorldException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

class WalletDocumentServiceTest {

    WalletDocumentRepository docRepo;
    WalletShareRepository shareRepo;
    WalletTypeService typeService;
    WalletStorageService storage;
    SettingsService settings;
    WalletDocumentService service;

    WalletDocumentTypeEntity activeType;

    @BeforeEach
    void setUp() {
        docRepo = mock(WalletDocumentRepository.class);
        shareRepo = mock(WalletShareRepository.class);
        typeService = mock(WalletTypeService.class);
        storage = mock(WalletStorageService.class);
        settings = mock(SettingsService.class);
        service = new WalletDocumentService(docRepo, shareRepo, typeService, storage, settings, new WalletMapper());

        activeType = WalletDocumentTypeEntity.builder().id("t1").code("PAN").displayName("PAN Card").active(true).build();
        when(typeService.get("t1")).thenReturn(activeType);
        when(settings.getLong(anyString())).thenReturn(10_485_760L);
        when(settings.getString(anyString())).thenReturn("application/pdf,image/png,image/jpeg");
    }

    private MockMultipartFile pdf(byte[] body) {
        return new MockMultipartFile("file", "scan.pdf", "application/pdf", body);
    }

    @Test
    void create_rejectsOversizedFile() {
        when(settings.getLong(anyString())).thenReturn(3L); // 3-byte cap
        byte[] body = "%PDF-1.4 hello".getBytes();
        assertThatThrownBy(() -> service.create(1L, pdf(body), "t1", null, null, null, null, null))
                .isInstanceOf(DbWorldException.class);
    }

    @Test
    void create_rejectsDisallowedContentType() {
        MockMultipartFile exe = new MockMultipartFile("file", "x.exe", "application/x-msdownload", "MZ...".getBytes());
        assertThatThrownBy(() -> service.create(1L, exe, "t1", null, null, null, null, null))
                .isInstanceOf(DbWorldException.class);
    }

    @Test
    void create_rejectsMagicByteMismatch() {
        byte[] notReallyPdf = "GIF89a".getBytes();
        assertThatThrownBy(() -> service.create(1L, pdf(notReallyPdf), "t1", null, null, null, null, null))
                .isInstanceOf(DbWorldException.class);
    }

    @Test
    void get_whenNotOwner_throwsNotFound() {
        when(docRepo.findByIdAndUserId("d1", 99L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.get(99L, "d1")).isInstanceOf(DbWorldException.class);
    }

    @Test
    void delete_removesShares_blob_andRow() {
        WalletDocumentEntity e = new WalletDocumentEntity();
        e.setId("d1"); e.setUserId(5L); e.setStoredFileName("d1.enc");
        when(docRepo.findByIdAndUserId("d1", 5L)).thenReturn(Optional.of(e));

        service.delete(5L, "d1");

        verify(shareRepo).deleteByDocumentId("d1");
        verify(storage).delete(5L, "d1.enc");
        verify(docRepo).delete(e);
    }
}
```
  Note: `MockMultipartFile` and `org.springframework.mock.web` come from `spring-boot-starter-test` (already on the test classpath).

- [ ] **Step 2: Run to verify it fails.** Run: `cd db-world-backend && "$MVN" -q -Dtest=WalletDocumentServiceTest test` — Expected: FAIL (class not found).

- [ ] **Step 3: Implement `WalletDocumentService`.**
```java
package com.db.dbworld.app.wallet.service;

import com.db.dbworld.app.admin.config.registry.ConfigKeys;
import com.db.dbworld.app.admin.config.service.SettingsService;
import com.db.dbworld.app.wallet.dto.*;
import com.db.dbworld.app.wallet.entity.WalletDocumentEntity;
import com.db.dbworld.app.wallet.entity.WalletDocumentTypeEntity;
import com.db.dbworld.app.wallet.mapper.WalletMapper;
import com.db.dbworld.app.wallet.repository.WalletDocumentRepository;
import com.db.dbworld.app.wallet.repository.WalletShareRepository;
import com.db.dbworld.core.exception.DbWorldException;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Log4j2
@Service
@RequiredArgsConstructor
public class WalletDocumentService {

    private final WalletDocumentRepository docRepo;
    private final WalletShareRepository shareRepo;
    private final WalletTypeService typeService;
    private final WalletStorageService storage;
    private final SettingsService settings;
    private final WalletMapper mapper;

    public List<WalletDocumentSummaryDto> list(Long userId, String typeId, String q) {
        List<WalletDocumentEntity> docs = (typeId == null || typeId.isBlank())
                ? docRepo.findByUserIdOrderByCreatedAtDesc(userId)
                : docRepo.findByUserIdAndDocumentTypeIdOrderByCreatedAtDesc(userId, typeId);
        Map<String, WalletDocumentTypeEntity> types = typeService.byId();
        String needle = q == null ? null : q.trim().toLowerCase();
        return docs.stream()
                .filter(d -> needle == null || needle.isEmpty()
                        || d.getLabel().toLowerCase().contains(needle))
                .map(d -> mapper.toSummary(d, types.get(d.getDocumentTypeId())))
                .toList();
    }

    public WalletDocumentDto get(Long userId, String id) {
        WalletDocumentEntity e = getOwnedEntity(userId, id);
        return mapper.toDetail(e, typeService.byId().get(e.getDocumentTypeId()));
    }

    public WalletDocumentEntity getOwnedEntity(Long userId, String id) {
        return docRepo.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new DbWorldException(HttpStatus.NOT_FOUND, "Document not found"));
    }

    public WalletDocumentDto create(Long userId, MultipartFile file, String typeId, String label,
                                    String number, LocalDate issueDate, LocalDate expiryDate, String notes) {
        if (file == null || file.isEmpty()) {
            throw new DbWorldException(HttpStatus.BAD_REQUEST, "A file is required");
        }
        WalletDocumentTypeEntity type = typeService.get(typeId);
        if (!type.isActive()) {
            throw new DbWorldException(HttpStatus.BAD_REQUEST, "Document type is not active");
        }
        long maxSize = settings.getLong(ConfigKeys.WALLET_MAX_FILE_SIZE_BYTES);
        if (file.getSize() > maxSize) {
            throw new DbWorldException(HttpStatus.BAD_REQUEST, "File exceeds the maximum size of " + maxSize + " bytes");
        }
        String contentType = normalizeType(file.getContentType());
        if (!allowedTypes().contains(contentType)) {
            throw new DbWorldException(HttpStatus.BAD_REQUEST, "Unsupported file type: " + contentType);
        }
        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            throw new DbWorldException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to read upload", e);
        }
        if (bytes.length > maxSize) {
            throw new DbWorldException(HttpStatus.BAD_REQUEST, "File exceeds the maximum size of " + maxSize + " bytes");
        }
        validateMagic(bytes, contentType);

        String storedFileName = UUID.randomUUID() + ".enc";
        storage.store(userId, storedFileName, bytes);

        WalletDocumentEntity e = new WalletDocumentEntity();
        e.setUserId(userId);
        e.setDocumentTypeId(type.getId());
        e.setLabel(label == null || label.isBlank() ? type.getDisplayName() : label.trim());
        e.setDocumentNumber(blankToNull(number));
        e.setIssueDate(issueDate);
        e.setExpiryDate(expiryDate);
        e.setNotes(blankToNull(notes));
        e.setOriginalFileName(safeName(file.getOriginalFilename()));
        e.setContentType(contentType);
        e.setFileSize(bytes.length);
        e.setStoredFileName(storedFileName);
        WalletDocumentEntity saved = docRepo.save(e);
        log.info("Wallet document {} created for user {}", saved.getId(), userId);
        return mapper.toDetail(saved, type);
    }

    public WalletDocumentDto update(Long userId, String id, UpdateDocumentRequest req) {
        WalletDocumentEntity e = getOwnedEntity(userId, id);
        e.setLabel(req.label().trim());
        e.setDocumentNumber(blankToNull(req.documentNumber()));
        e.setIssueDate(req.issueDate());
        e.setExpiryDate(req.expiryDate());
        e.setNotes(blankToNull(req.notes()));
        WalletDocumentEntity saved = docRepo.save(e);
        return mapper.toDetail(saved, typeService.byId().get(saved.getDocumentTypeId()));
    }

    @Transactional
    public void delete(Long userId, String id) {
        WalletDocumentEntity e = getOwnedEntity(userId, id);
        shareRepo.deleteByDocumentId(e.getId());
        storage.delete(userId, e.getStoredFileName());
        docRepo.delete(e);
        log.info("Wallet document {} deleted for user {}", id, userId);
    }

    public WalletContent loadContent(Long userId, String id) {
        WalletDocumentEntity e = getOwnedEntity(userId, id);
        return new WalletContent(e.getOriginalFileName(), e.getContentType(),
                storage.load(userId, e.getStoredFileName()));
    }

    // ---- helpers ----
    private Set<String> allowedTypes() {
        String csv = settings.getString(ConfigKeys.WALLET_ALLOWED_CONTENT_TYPES);
        return Arrays.stream(csv.split(","))
                .map(s -> s.trim().toLowerCase())
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toSet());
    }

    private static String normalizeType(String raw) {
        if (raw == null) return "application/octet-stream";
        int semi = raw.indexOf(';');
        return (semi >= 0 ? raw.substring(0, semi) : raw).trim().toLowerCase();
    }

    private static void validateMagic(byte[] b, String contentType) {
        boolean ok = switch (contentType) {
            case "application/pdf" -> startsWith(b, new byte[]{'%', 'P', 'D', 'F'});
            case "image/png"       -> startsWith(b, new byte[]{(byte) 0x89, 'P', 'N', 'G'});
            case "image/jpeg"      -> b.length > 2 && (b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8;
            default                -> false;
        };
        if (!ok) {
            throw new DbWorldException(HttpStatus.BAD_REQUEST, "File content does not match its type " + contentType);
        }
    }

    private static boolean startsWith(byte[] data, byte[] prefix) {
        if (data.length < prefix.length) return false;
        for (int i = 0; i < prefix.length; i++) if (data[i] != prefix[i]) return false;
        return true;
    }

    private static String blankToNull(String s) { return (s == null || s.isBlank()) ? null : s.trim(); }

    private static String safeName(String original) {
        if (original == null || original.isBlank()) return "document";
        return Path.of(original).getFileName().toString();
    }
}
```

- [ ] **Step 4: Run the test to verify it passes.** Run: `cd db-world-backend && "$MVN" -q -Dtest=WalletDocumentServiceTest test` — Expected: PASS (5 tests).
- [ ] **Step 5: Commit.**
```bash
git add db-world-backend/src/main/java/com/db/dbworld/app/wallet/service/WalletDocumentService.java \
        db-world-backend/src/test/java/com/db/dbworld/app/wallet/service/WalletDocumentServiceTest.java
git commit -m "feat(wallet): document service (upload validation, owner isolation, CRUD)"
```

### Task 4.2: content-writer util + `WalletDocumentController`

**Files:**
- Create: `.../app/wallet/controller/WalletContentWriter.java`
- Create: `.../app/wallet/controller/WalletDocumentController.java`

**Interfaces:**
- Consumes: `WalletDocumentService` (4.1), `WalletTypeService`, `WalletMapper`, `UserContext`.
- Produces: user REST at `/api/wallet` (documents CRUD + content stream + active document-types); `WalletContentWriter.write(HttpServletResponse, WalletContent, boolean inline)` reused by the public share controller.

- [ ] **Step 1: Implement `WalletContentWriter`.**
```java
package com.db.dbworld.app.wallet.controller;

import com.db.dbworld.app.wallet.dto.WalletContent;
import com.db.dbworld.core.exception.DbWorldException;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;

import java.io.IOException;
import java.io.OutputStream;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

final class WalletContentWriter {
    private WalletContentWriter() {}

    static void write(HttpServletResponse response, WalletContent content, boolean inline) {
        String filename = URLEncoder.encode(content.fileName(), StandardCharsets.UTF_8).replace("+", "%20");
        String disposition = (inline ? "inline" : "attachment") + "; filename*=UTF-8''" + filename;
        response.setContentType(content.contentType());
        response.setHeader("Content-Disposition", disposition);
        response.setContentLengthLong(content.data().length);
        try (OutputStream out = response.getOutputStream()) {
            out.write(content.data());
        } catch (IOException e) {
            throw new DbWorldException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to stream document", e);
        }
    }
}
```

- [ ] **Step 2: Implement `WalletDocumentController`.**
```java
package com.db.dbworld.app.wallet.controller;

import com.db.dbworld.app.wallet.dto.*;
import com.db.dbworld.app.wallet.mapper.WalletMapper;
import com.db.dbworld.app.wallet.service.WalletDocumentService;
import com.db.dbworld.app.wallet.service.WalletTypeService;
import com.db.dbworld.core.context.UserContext;
import com.db.dbworld.core.role.annotations.AnyRole;
import com.db.dbworld.payloads.ApiResponse;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/wallet")
@RequiredArgsConstructor
@AnyRole
public class WalletDocumentController {

    private final WalletDocumentService documentService;
    private final WalletTypeService typeService;
    private final WalletMapper mapper;
    private final UserContext userContext;

    @GetMapping("/document-types")
    public ApiResponse<List<WalletDocumentTypeDto>> activeTypes() {
        return ApiResponse.success(typeService.listActive().stream().map(mapper::toTypeDto).toList());
    }

    @GetMapping("/documents")
    public ApiResponse<List<WalletDocumentSummaryDto>> list(
            @RequestParam(required = false) String typeId,
            @RequestParam(required = false) String q) {
        return ApiResponse.success(documentService.list(userContext.userId(), typeId, q));
    }

    @GetMapping("/documents/{id}")
    public ApiResponse<WalletDocumentDto> get(@PathVariable String id) {
        return ApiResponse.success(documentService.get(userContext.userId(), id));
    }

    @PostMapping(value = "/documents", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<WalletDocumentDto> create(
            @RequestParam("file") MultipartFile file,
            @RequestParam String typeId,
            @RequestParam(required = false) String label,
            @RequestParam(required = false) String number,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate issueDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate expiryDate,
            @RequestParam(required = false) String notes) {
        WalletDocumentDto dto = documentService.create(userContext.userId(), file, typeId, label, number,
                issueDate, expiryDate, notes);
        return ApiResponse.success("Document added", dto);
    }

    @PutMapping("/documents/{id}")
    public ApiResponse<WalletDocumentDto> update(@PathVariable String id,
                                                 @Valid @RequestBody UpdateDocumentRequest req) {
        return ApiResponse.success("Document updated", documentService.update(userContext.userId(), id, req));
    }

    @DeleteMapping("/documents/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) {
        documentService.delete(userContext.userId(), id);
        return ApiResponse.success("Document deleted");
    }

    @GetMapping("/documents/{id}/content")
    public void content(@PathVariable String id,
                        @RequestParam(defaultValue = "inline") String disposition,
                        HttpServletResponse response) {
        WalletContent content = documentService.loadContent(userContext.userId(), id);
        WalletContentWriter.write(response, content, !"attachment".equalsIgnoreCase(disposition));
    }
}
```

- [ ] **Step 3: Compile.** Run: `cd db-world-backend && "$MVN" -q compile` — Expected: BUILD SUCCESS.
- [ ] **Step 4: Commit.**
```bash
git add db-world-backend/src/main/java/com/db/dbworld/app/wallet/controller/WalletContentWriter.java \
        db-world-backend/src/main/java/com/db/dbworld/app/wallet/controller/WalletDocumentController.java
git commit -m "feat(wallet): user document controller (upload/list/detail/update/delete/content)"
```

---

## Phase 5 — Sharing

### Task 5.1: `WalletShareService`

**Files:**
- Create: `.../app/wallet/service/WalletShareService.java`
- Test: `.../test/.../app/wallet/service/WalletShareServiceTest.java`

**Interfaces:**
- Consumes: `WalletShareRepository`, `WalletDocumentService` (`getOwnedEntity`, storage access), `WalletStorageService`, `WalletDocumentRepository`, `WalletTypeService`, `WalletMapper`.
- Produces `WalletShareService` (`@Service`):
  - `ShareDto create(Long userId, String documentId, CreateShareRequest req)` (returns raw token once)
  - `List<ShareDto> listForDocument(Long userId, String documentId)`
  - `void revoke(Long userId, String shareId)`
  - `SharedDocumentInfoDto resolveInfo(String rawToken)`
  - `WalletContent resolveContent(String rawToken)` (increments access count)

- [ ] **Step 1: Write the failing test.**
```java
package com.db.dbworld.app.wallet.service;

import com.db.dbworld.app.wallet.dto.CreateShareRequest;
import com.db.dbworld.app.wallet.dto.ShareDto;
import com.db.dbworld.app.wallet.entity.WalletDocumentEntity;
import com.db.dbworld.app.wallet.entity.WalletShareEntity;
import com.db.dbworld.app.wallet.mapper.WalletMapper;
import com.db.dbworld.app.wallet.repository.WalletDocumentRepository;
import com.db.dbworld.app.wallet.repository.WalletShareRepository;
import com.db.dbworld.core.exception.DbWorldException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class WalletShareServiceTest {

    WalletShareRepository shareRepo;
    WalletDocumentRepository docRepo;
    WalletDocumentService documentService;
    WalletStorageService storage;
    WalletTypeService typeService;
    WalletShareService service;
    Map<String, WalletShareEntity> store;

    @BeforeEach
    void setUp() {
        shareRepo = mock(WalletShareRepository.class);
        docRepo = mock(WalletDocumentRepository.class);
        documentService = mock(WalletDocumentService.class);
        storage = mock(WalletStorageService.class);
        typeService = mock(WalletTypeService.class);
        service = new WalletShareService(shareRepo, docRepo, documentService, storage, typeService, new WalletMapper());

        store = new HashMap<>();
        when(shareRepo.save(any(WalletShareEntity.class))).thenAnswer(a -> {
            WalletShareEntity e = a.getArgument(0);
            if (e.getId() == null) e.setId("s-" + (store.size() + 1));
            store.put(e.getTokenHash(), e);
            return e;
        });
        when(shareRepo.findByTokenHash(any())).thenAnswer(a -> Optional.ofNullable(store.get(a.getArgument(0))));
    }

    @Test
    void create_returnsToken_andStoresOnlyHash() {
        WalletDocumentEntity doc = new WalletDocumentEntity();
        doc.setId("d1"); doc.setUserId(1L);
        when(documentService.getOwnedEntity(1L, "d1")).thenReturn(doc);

        ShareDto dto = service.create(1L, "d1", new CreateShareRequest(24, null));

        assertThat(dto.token()).isNotBlank();
        // stored key is the hash, never the raw token
        assertThat(store.keySet()).doesNotContain(dto.token());
        assertThat(store).hasSize(1);
    }

    @Test
    void resolveContent_deniesExpiredShare() {
        WalletShareEntity expired = new WalletShareEntity();
        expired.setId("s1"); expired.setDocumentId("d1"); expired.setTokenHash("HASH");
        expired.setExpiresAt(Instant.now().minus(1, ChronoUnit.HOURS));
        store.put("HASH", expired);
        // token whose sha256 == "HASH" is impractical; instead resolve by stubbing hashing via a real token:
        // simpler: assert expired guard through resolveInfo using a freshly created share below.
        assertThatThrownBy(() -> service.resolveContentByHashForTest("HASH"))
                .isInstanceOf(DbWorldException.class);
    }

    @Test
    void revoke_marksRevoked() {
        WalletShareEntity s = new WalletShareEntity();
        s.setId("s1"); s.setDocumentId("d1"); s.setCreatedByUserId(1L); s.setTokenHash("H");
        s.setExpiresAt(Instant.now().plus(1, ChronoUnit.HOURS));
        when(shareRepo.findById("s1")).thenReturn(Optional.of(s));
        WalletDocumentEntity doc = new WalletDocumentEntity(); doc.setId("d1"); doc.setUserId(1L);
        when(documentService.getOwnedEntity(1L, "d1")).thenReturn(doc);

        service.revoke(1L, "s1");

        assertThat(s.isRevoked()).isTrue();
        verify(shareRepo).save(s);
    }
}
```
  Note: `resolveContentByHashForTest(String hash)` is a package-private test seam on the service that looks the share up by hash directly and runs the same validation as `resolveContent`, so expiry/revoke/cap logic is testable without reversing SHA-256.

- [ ] **Step 2: Run to verify it fails.** Run: `cd db-world-backend && "$MVN" -q -Dtest=WalletShareServiceTest test` — Expected: FAIL (class not found).

- [ ] **Step 3: Implement `WalletShareService`.**
```java
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
```

- [ ] **Step 4: Run the test to verify it passes.** Run: `cd db-world-backend && "$MVN" -q -Dtest=WalletShareServiceTest test` — Expected: PASS (3 tests).
- [ ] **Step 5: Commit.**
```bash
git add db-world-backend/src/main/java/com/db/dbworld/app/wallet/service/WalletShareService.java \
        db-world-backend/src/test/java/com/db/dbworld/app/wallet/service/WalletShareServiceTest.java
git commit -m "feat(wallet): share service (hashed tokens, expiry/revoke/cap, access log)"
```

### Task 5.2: share controllers + public API allow-listing

**Files:**
- Create: `.../app/wallet/controller/WalletShareController.java`
- Create: `.../app/wallet/controller/WalletSharePublicController.java`
- Modify: `.../config/AppConstants.java` (add `/api/wallet/shared/**` to `PUBLIC_APIS`)

**Interfaces:**
- Consumes: `WalletShareService` (5.1), `UserContext`, `WalletContentWriter` (4.2).
- Produces: owner share REST under `/api/wallet`; public share REST under `/api/wallet/shared`.

- [ ] **Step 1: Implement `WalletShareController` (owner-scoped).**
```java
package com.db.dbworld.app.wallet.controller;

import com.db.dbworld.app.wallet.dto.CreateShareRequest;
import com.db.dbworld.app.wallet.dto.ShareDto;
import com.db.dbworld.app.wallet.service.WalletShareService;
import com.db.dbworld.core.context.UserContext;
import com.db.dbworld.core.role.annotations.AnyRole;
import com.db.dbworld.payloads.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/wallet")
@RequiredArgsConstructor
@AnyRole
public class WalletShareController {

    private final WalletShareService shareService;
    private final UserContext userContext;

    @PostMapping("/documents/{id}/shares")
    public ApiResponse<ShareDto> create(@PathVariable String id, @Valid @RequestBody CreateShareRequest req) {
        return ApiResponse.success("Share link created", shareService.create(userContext.userId(), id, req));
    }

    @GetMapping("/documents/{id}/shares")
    public ApiResponse<List<ShareDto>> list(@PathVariable String id) {
        return ApiResponse.success(shareService.listForDocument(userContext.userId(), id));
    }

    @DeleteMapping("/shares/{shareId}")
    public ApiResponse<Void> revoke(@PathVariable String shareId) {
        shareService.revoke(userContext.userId(), shareId);
        return ApiResponse.success("Share link revoked");
    }
}
```

- [ ] **Step 2: Implement `WalletSharePublicController` (no auth).**
```java
package com.db.dbworld.app.wallet.controller;

import com.db.dbworld.app.wallet.dto.SharedDocumentInfoDto;
import com.db.dbworld.app.wallet.dto.WalletContent;
import com.db.dbworld.app.wallet.service.WalletShareService;
import com.db.dbworld.payloads.ApiResponse;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/wallet/shared")
@RequiredArgsConstructor
public class WalletSharePublicController {

    private final WalletShareService shareService;

    @GetMapping("/{token}/info")
    public ApiResponse<SharedDocumentInfoDto> info(@PathVariable String token) {
        return ApiResponse.success(shareService.resolveInfo(token));
    }

    @GetMapping("/{token}/content")
    public void content(@PathVariable String token,
                        @RequestParam(defaultValue = "inline") String disposition,
                        HttpServletResponse response) {
        WalletContent content = shareService.resolveContent(token);
        WalletContentWriter.write(response, content, !"attachment".equalsIgnoreCase(disposition));
    }
}
```

- [ ] **Step 3: Allow-list the public share paths.** In `AppConstants.java`, add `"/api/wallet/shared/**"` to the `PUBLIC_APIS` array (near `"/api/admin/file-manager/download/stream"`).

- [ ] **Step 4: Compile.** Run: `cd db-world-backend && "$MVN" -q compile` — Expected: BUILD SUCCESS.
- [ ] **Step 5: Commit.**
```bash
git add db-world-backend/src/main/java/com/db/dbworld/app/wallet/controller/WalletShareController.java \
        db-world-backend/src/main/java/com/db/dbworld/app/wallet/controller/WalletSharePublicController.java \
        db-world-backend/src/main/java/com/db/dbworld/config/AppConstants.java
git commit -m "feat(wallet): owner + public share controllers; allow-list public share API"
```

---

## Phase 6 — Backend full build & test gate

### Task 6.1: full test run + boot config note

**Files:**
- Modify: `db-world-backend/src/main/resources/application.yml` (documented optional key)
- Modify: `db-world-backend/README` or runtime env notes (documentation)

- [ ] **Step 1: Add a documented (commented) config anchor** in `application.yml` so operators know the key exists. Under a top-level `wallet:` block add:
```yaml
# Wallet document encryption. Set a dedicated 256-bit key (base64) in ../runtime/backend.env:
#   WALLET_ENCRYPTION_KEY=<base64 of 32 random bytes>
# If unset, the key is derived from JASYPT_PASSWORD (dev only — a WARN is logged).
# WARNING: losing this key makes all stored wallet documents unrecoverable — back it up.
wallet:
  encryption-key: ${WALLET_ENCRYPTION_KEY:}
```

- [ ] **Step 2: Run the full wallet + config test suite.**
  Run: `cd db-world-backend && "$MVN" -q -Dtest='Wallet*Test,SettingsServiceTest' test`
  Expected: PASS — all wallet tests + the (updated) settings test green.

- [ ] **Step 3: Full compile of the whole backend** (catches any wiring/import mistakes across modules):
  Run: `cd db-world-backend && "$MVN" -q compile`
  Expected: BUILD SUCCESS.

- [ ] **Step 4: Commit.**
```bash
git add db-world-backend/src/main/resources/application.yml
git commit -m "chore(wallet): document WALLET_ENCRYPTION_KEY config + backend test gate"
```

---

## Phase 7 — Frontend user feature (`src/features/wallet/`)

> No automated frontend test harness exists — each task ends with a **manual verification via the browser preview tools** (`preview_start` using `.claude/launch.json`, then `preview_snapshot`/`preview_console_logs`/`preview_screenshot`). Run the backend locally so `/api/wallet/**` is reachable.

### Task 7.1: route constants + api module

**Files:**
- Modify: `db-world-frontend/src/shared/constants/index.js`
- Create: `db-world-frontend/src/features/wallet/api/walletApi.js`

**Interfaces:**
- Produces: `Constants.DB_WALLET_ROUTE = "/db-world/db-wallet"`, `Constants.DB_WALLET_SHARE_ROUTE = "/db-world/shared-doc/:token"`; the `walletApi` functions used by hooks/components.

- [ ] **Step 1: Add the route constants.** In `src/shared/constants/index.js`, add near the other `DB_*_ROUTE` consts:
```js
export const DB_WALLET_ROUTE = `${DB_WORLD_HOME_ROUTE}/db-wallet`;
export const DB_WALLET_SHARE_ROUTE = `${DB_WORLD_HOME_ROUTE}/shared-doc/:token`;
```
  and add BOTH to the default-export object (near the other route entries):
```js
  DB_WALLET_ROUTE,
  DB_WALLET_SHARE_ROUTE,
```

- [ ] **Step 2: Create `walletApi.js`.**
```js
import axiosInstance from '@shared/components/ui/utils/AxiosInstants';
import { getApiBaseUrl, publicShareUrl } from '@shared/config/apiBaseUrl';

const BASE = '/api/wallet';
const unwrap = (r) => r.data?.data ?? r.data;

export const fetchDocumentTypes = () =>
  axiosInstance.get(`${BASE}/document-types`).then(unwrap);

export const fetchDocuments = ({ typeId, q } = {}) =>
  axiosInstance.get(`${BASE}/documents`, {
    params: { typeId: typeId || undefined, q: q || undefined },
  }).then(unwrap);

export const fetchDocument = (id) =>
  axiosInstance.get(`${BASE}/documents/${id}`).then(unwrap);

export const addDocument = (values, onProgress) => {
  const fd = new FormData();
  fd.append('file', values.file);
  fd.append('typeId', values.typeId);
  if (values.label)      fd.append('label', values.label);
  if (values.number)     fd.append('number', values.number);
  if (values.issueDate)  fd.append('issueDate', values.issueDate);
  if (values.expiryDate) fd.append('expiryDate', values.expiryDate);
  if (values.notes)      fd.append('notes', values.notes);
  return axiosInstance.post(`${BASE}/documents`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => onProgress?.(Math.round((e.loaded * 100) / (e.total ?? 1))),
  }).then(unwrap);
};

export const updateDocument = (id, body) =>
  axiosInstance.put(`${BASE}/documents/${id}`, body).then(unwrap);

export const deleteDocument = (id) =>
  axiosInstance.delete(`${BASE}/documents/${id}`).then((r) => r.data);

/** Authenticated content fetch as a Blob (used for both inline preview and download). */
export const fetchContentBlob = (id, disposition = 'inline') =>
  axiosInstance.get(`${BASE}/documents/${id}/content`, {
    params: { disposition }, responseType: 'blob',
  }).then((r) => r.data);

export const createShare = (id, body) =>
  axiosInstance.post(`${BASE}/documents/${id}/shares`, body).then(unwrap);
export const fetchShares = (id) =>
  axiosInstance.get(`${BASE}/documents/${id}/shares`).then(unwrap);
export const revokeShare = (shareId) =>
  axiosInstance.delete(`${BASE}/shares/${shareId}`).then((r) => r.data);

/** Full external URL for a share token. NOTE: verify publicShareUrl() returns the web origin. */
export const buildShareUrl = (token) => `${publicShareUrl()}/db-world/shared-doc/${token}`;

export const fetchSharedInfo = (token) =>
  axiosInstance.get(`${BASE}/shared/${token}/info`).then(unwrap);
export const sharedContentUrl = (token, disposition = 'inline') =>
  `${getApiBaseUrl()}${BASE}/shared/${encodeURIComponent(token)}/content?disposition=${disposition}`;
```

- [ ] **Step 3: Verify it builds.** Run: `cd db-world-frontend && npm run build 2>&1 | tail -20` (or rely on the dev server compiling). Expected: no import errors.
- [ ] **Step 4: Commit.**
```bash
git add db-world-frontend/src/shared/constants/index.js db-world-frontend/src/features/wallet/api/walletApi.js
git commit -m "feat(wallet-ui): route constants + wallet api module"
```

### Task 7.2: query/mutation hooks + download util

**Files:**
- Create: `db-world-frontend/src/features/wallet/hooks/useWallet.js`
- Create: `db-world-frontend/src/features/wallet/utils/download.js`

**Interfaces:**
- Produces: `useDocumentTypes()`, `useDocuments(filters)`, `useAddDocument()`, `useUpdateDocument()`, `useDeleteDocument()`; `downloadBlob(blob, filename)` (web anchor save; Android handled in Phase 9).

- [ ] **Step 1: Create `hooks/useWallet.js`.**
```js
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import * as api from '../api/walletApi';

const errMsg = (e, fallback) => e?.response?.data?.message ?? fallback;

export function useDocumentTypes() {
  return useQuery({ queryKey: ['wallet', 'types'], queryFn: api.fetchDocumentTypes, staleTime: 60_000 });
}

export function useDocuments(filters) {
  return useQuery({
    queryKey: ['wallet', 'documents', filters],
    queryFn: () => api.fetchDocuments(filters),
  });
}

export function useAddDocument() {
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  return useMutation({
    mutationFn: ({ values, onProgress }) => api.addDocument(values, onProgress),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wallet', 'documents'] });
      enqueueSnackbar('Document added', { variant: 'success' });
    },
    onError: (e) => enqueueSnackbar(errMsg(e, 'Failed to add document'), { variant: 'error' }),
  });
}

export function useUpdateDocument() {
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  return useMutation({
    mutationFn: ({ id, body }) => api.updateDocument(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wallet', 'documents'] });
      enqueueSnackbar('Document updated', { variant: 'success' });
    },
    onError: (e) => enqueueSnackbar(errMsg(e, 'Failed to update document'), { variant: 'error' }),
  });
}

export function useDeleteDocument() {
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  return useMutation({
    mutationFn: (id) => api.deleteDocument(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wallet', 'documents'] });
      enqueueSnackbar('Document deleted', { variant: 'success' });
    },
    onError: (e) => enqueueSnackbar(errMsg(e, 'Failed to delete document'), { variant: 'error' }),
  });
}
```

- [ ] **Step 2: Create `utils/download.js`.**
```js
import { Capacitor } from '@capacitor/core';

/** Saves a Blob to the user's device. Web: anchor download. Native: handled in Phase 9. */
export async function downloadBlob(blob, filename) {
  if (Capacitor?.isNativePlatform?.()) {
    // Android/native path is implemented in Phase 9 (Capacitor Filesystem + Share).
    const { saveBlobNative } = await import('@platform/android/walletDownload');
    return saveBlobNative(blob, filename);
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
```
  Note: the `@platform/android/walletDownload` dynamic import only resolves on native (Phase 9 creates it); guard with `Capacitor.isNativePlatform()` keeps web builds clean.

- [ ] **Step 3: Verify build / no import errors** (dev server compiles).
- [ ] **Step 4: Commit.**
```bash
git add db-world-frontend/src/features/wallet/hooks/useWallet.js db-world-frontend/src/features/wallet/utils/download.js
git commit -m "feat(wallet-ui): query/mutation hooks + blob download util"
```

### Task 7.3: Zod schema, `WalletTypeSelect`, `AddDocumentDialog` (minimal form)

**Files:**
- Create: `db-world-frontend/src/features/wallet/schemas/documentSchemas.js`
- Create: `db-world-frontend/src/features/wallet/components/WalletTypeSelect.jsx`
- Create: `db-world-frontend/src/features/wallet/components/AddDocumentDialog.jsx`

**Interfaces:**
- Consumes: `useDocumentTypes`, `useAddDocument`. Produces the Add dialog (Type + File required; rest in a collapsed section).

- [ ] **Step 1: Create the schema.** Only metadata is validated by Zod; the file is validated separately (RHF doesn't bind File well).
```js
import { z } from 'zod';

export const addDocumentSchema = z.object({
  typeId: z.string().min(1, 'Select a document type'),
  label:  z.string().max(150, 'Max 150 chars').optional().or(z.literal('')),
  number: z.string().max(100).optional().or(z.literal('')),
  issueDate:  z.string().optional().or(z.literal('')),
  expiryDate: z.string().optional().or(z.literal('')),
  notes:  z.string().max(2000).optional().or(z.literal('')),
});

export const editDocumentSchema = z.object({
  label:  z.string().min(1, 'Required').max(150),
  number: z.string().max(100).optional().or(z.literal('')),
  issueDate:  z.string().optional().or(z.literal('')),
  expiryDate: z.string().optional().or(z.literal('')),
  notes:  z.string().max(2000).optional().or(z.literal('')),
});

export const ACCEPTED_MIME = ['application/pdf', 'image/png', 'image/jpeg'];
```

- [ ] **Step 2: Create `WalletTypeSelect.jsx`** (RHF-bound select fed by active types).
```jsx
import { Controller } from 'react-hook-form';
import { TextField, MenuItem } from '@mui/material';
import { getSelectMenuProps } from '@shared/theme';
import { useDocumentTypes } from '../hooks/useWallet';

export default function WalletTypeSelect({ control, errors, T, name = 'typeId', onTypeChange }) {
  const { data: types = [] } = useDocumentTypes();
  return (
    <Controller name={name} control={control} render={({ field }) => (
      <TextField
        {...field}
        select fullWidth size="small" label="Document type"
        value={field.value ?? ''}
        onChange={(e) => { field.onChange(e); onTypeChange?.(types.find(t => t.id === e.target.value)); }}
        error={!!errors[name]} helperText={errors[name]?.message}
        SelectProps={{ MenuProps: getSelectMenuProps(T) }}
      >
        {types.map((t) => (
          <MenuItem key={t.id} value={t.id} sx={{ color: T.textPrimary }}>{t.displayName}</MenuItem>
        ))}
      </TextField>
    )} />
  );
}
```

- [ ] **Step 3: Create `AddDocumentDialog.jsx`** (minimal form; file dropzone modeled on `UploadDialog.jsx`; number field appears only when the picked type `requiresNumber`).
```jsx
import { useRef, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, IconButton, Box, Typography,
  LinearProgress, Collapse, Grid, TextField,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSnackbar } from 'notistack';
import { useT } from '@shared/theme';
import { addDocumentSchema, ACCEPTED_MIME } from '../schemas/documentSchemas';
import { useAddDocument } from '../hooks/useWallet';
import WalletTypeSelect from './WalletTypeSelect';

const MAX_BYTES = 10 * 1024 * 1024; // client mirror of the default cap; server is source of truth

export default function AddDocumentDialog({ open, onClose }) {
  const T = useT();
  const { enqueueSnackbar } = useSnackbar();
  const inputRef = useRef();
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [showMore, setShowMore] = useState(false);
  const [pickedType, setPickedType] = useState(null);

  const { control, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(addDocumentSchema),
    defaultValues: { typeId: '', label: '', number: '', issueDate: '', expiryDate: '', notes: '' },
  });
  const { mutate, isPending } = useAddDocument();

  const pickFile = (f) => {
    if (!f) return;
    if (!ACCEPTED_MIME.includes(f.type)) { enqueueSnackbar('Only PDF, PNG or JPEG allowed', { variant: 'error' }); return; }
    if (f.size > MAX_BYTES) { enqueueSnackbar('File exceeds 10 MB', { variant: 'error' }); return; }
    setFile(f);
  };

  const close = () => { if (isPending) return; reset(); setFile(null); setProgress(0); setShowMore(false); setPickedType(null); onClose(); };

  const submit = (values) => {
    if (!file) { enqueueSnackbar('Please choose a file', { variant: 'error' }); return; }
    mutate(
      { values: { ...values, file }, onProgress: setProgress },
      { onSuccess: close },
    );
  };

  const fieldSx = { '& .MuiInputBase-root': { color: T.textPrimary }, '& label': { color: T.textMuted } };

  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="sm"
      PaperProps={{ sx: { bgcolor: T.sidebar, border: `1px solid ${T.border}` } }}>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: T.textPrimary }}>
        Add document
        <IconButton size="small" onClick={close} sx={{ color: T.textFaint }}><CloseIcon /></IconButton>
      </DialogTitle>
      <form onSubmit={handleSubmit(submit)}>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <WalletTypeSelect control={control} errors={errors} T={T} onTypeChange={setPickedType} />

          {/* File dropzone */}
          <Box
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); pickFile(e.dataTransfer.files?.[0]); }}
            sx={{ border: `2px dashed ${T.border}`, borderRadius: 2, p: 3, textAlign: 'center', cursor: 'pointer',
                  '&:hover': { borderColor: T.teal, bgcolor: T.tealBg } }}>
            <CloudUploadIcon sx={{ fontSize: 32, color: T.textFaint }} />
            <Typography sx={{ fontSize: 13, color: T.textMuted }}>
              {file ? file.name : 'Drop a PDF/image or click to browse (max 10 MB)'}
            </Typography>
            <input ref={inputRef} type="file" hidden accept=".pdf,image/png,image/jpeg"
                   onChange={(e) => pickFile(e.target.files?.[0])} />
          </Box>
          {isPending && <LinearProgress variant="determinate" value={progress}
            sx={{ '& .MuiLinearProgress-bar': { bgcolor: T.teal } }} />}

          <Button onClick={() => setShowMore((s) => !s)} startIcon={<ExpandMoreIcon />}
            sx={{ color: T.textMuted, justifyContent: 'flex-start' }}>
            {showMore ? 'Hide details' : 'Add details (optional)'}
          </Button>
          <Collapse in={showMore}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Controller name="label" control={control} render={({ field }) => (
                  <TextField {...field} fullWidth size="small" label="Label (optional)" sx={fieldSx} />
                )} />
              </Grid>
              {(pickedType?.requiresNumber ?? true) && (
                <Grid item xs={12}>
                  <Controller name="number" control={control} render={({ field }) => (
                    <TextField {...field} fullWidth size="small"
                      label={pickedType?.numberLabel || 'Document number'} sx={fieldSx} />
                  )} />
                </Grid>
              )}
              <Grid item xs={6}>
                <Controller name="issueDate" control={control} render={({ field }) => (
                  <TextField {...field} fullWidth size="small" type="date" label="Issue date"
                    InputLabelProps={{ shrink: true }} sx={fieldSx} />
                )} />
              </Grid>
              <Grid item xs={6}>
                <Controller name="expiryDate" control={control} render={({ field }) => (
                  <TextField {...field} fullWidth size="small" type="date" label="Expiry date"
                    InputLabelProps={{ shrink: true }} sx={fieldSx} />
                )} />
              </Grid>
              <Grid item xs={12}>
                <Controller name="notes" control={control} render={({ field }) => (
                  <TextField {...field} fullWidth size="small" multiline minRows={2} label="Notes" sx={fieldSx} />
                )} />
              </Grid>
            </Grid>
          </Collapse>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={close} sx={{ color: T.textMuted }}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={isPending || !file}
            sx={{ bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover } }}>
            {isPending ? 'Adding…' : 'Add document'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
```

- [ ] **Step 4: Commit.**
```bash
git add db-world-frontend/src/features/wallet/schemas/documentSchemas.js \
        db-world-frontend/src/features/wallet/components/WalletTypeSelect.jsx \
        db-world-frontend/src/features/wallet/components/AddDocumentDialog.jsx
git commit -m "feat(wallet-ui): minimal add-document dialog + type select + schemas"
```

### Task 7.4: `DocumentCard` + wallet page (`index.jsx`)

**Files:**
- Create: `db-world-frontend/src/features/wallet/components/DocumentCard.jsx`
- Create: `db-world-frontend/src/features/wallet/index.jsx`

**Interfaces:**
- Consumes: `useDocuments`, `useDocumentTypes`, `useDeleteDocument`, all dialogs. Produces the default-export page.

- [ ] **Step 1: Create `DocumentCard.jsx`.**
```jsx
import { Box, Typography, IconButton, Chip, Menu, MenuItem } from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DescriptionIcon from '@mui/icons-material/Description';
import ImageIcon from '@mui/icons-material/Image';
import { useState } from 'react';
import { useT } from '@shared/theme';

export default function DocumentCard({ doc, onPreview, onDownload, onEdit, onShare, onDelete }) {
  const T = useT();
  const [anchor, setAnchor] = useState(null);
  const isPdf = doc.contentType === 'application/pdf';
  return (
    <Box sx={{ bgcolor: T.glass, border: `1px solid ${T.border}`, borderRadius: 2, p: 2,
               display: 'flex', flexDirection: 'column', gap: 1, cursor: 'pointer',
               '&:hover': { borderColor: T.teal } }}
         onClick={() => onPreview(doc)}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        {isPdf ? <DescriptionIcon sx={{ color: T.teal }} /> : <ImageIcon sx={{ color: T.teal }} />}
        <IconButton size="small" onClick={(e) => { e.stopPropagation(); setAnchor(e.currentTarget); }}
          sx={{ color: T.textFaint }}><MoreVertIcon fontSize="small" /></IconButton>
      </Box>
      <Typography sx={{ fontSize: 14, fontWeight: 700, color: T.textPrimary }} noWrap>{doc.label}</Typography>
      {doc.typeDisplayName && <Chip label={doc.typeDisplayName} size="small"
        sx={{ alignSelf: 'flex-start', bgcolor: T.tealBg, color: T.teal, fontSize: 11 }} />}
      {doc.maskedNumber && <Typography sx={{ fontSize: 12, color: T.textMuted }}>{doc.maskedNumber}</Typography>}
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}
        onClick={(e) => e.stopPropagation()}>
        <MenuItem onClick={() => { setAnchor(null); onPreview(doc); }}>Preview</MenuItem>
        <MenuItem onClick={() => { setAnchor(null); onDownload(doc); }}>Download</MenuItem>
        <MenuItem onClick={() => { setAnchor(null); onEdit(doc); }}>Edit</MenuItem>
        <MenuItem onClick={() => { setAnchor(null); onShare(doc); }}>Share</MenuItem>
        <MenuItem onClick={() => { setAnchor(null); onDelete(doc); }} sx={{ color: T.error }}>Delete</MenuItem>
      </Menu>
    </Box>
  );
}
```

- [ ] **Step 2: Create the page `index.jsx`.**
```jsx
import { useMemo, useState } from 'react';
import { Box, Typography, Button, TextField, Chip, CircularProgress } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useConfirm } from 'material-ui-confirm';
import { useT } from '@shared/theme';
import { useDocuments, useDocumentTypes, useDeleteDocument } from './hooks/useWallet';
import { fetchContentBlob } from './api/walletApi';
import { downloadBlob } from './utils/download';
import DocumentCard from './components/DocumentCard';
import AddDocumentDialog from './components/AddDocumentDialog';
import EditDocumentDialog from './components/EditDocumentDialog';
import DocumentPreviewDialog from './components/DocumentPreviewDialog';
import ShareDialog from './components/ShareDialog';

export default function WalletPage() {
  const T = useT();
  const confirm = useConfirm();
  const [q, setQ] = useState('');
  const [typeId, setTypeId] = useState('');
  const filters = useMemo(() => ({ typeId, q }), [typeId, q]);
  const { data: docs = [], isLoading } = useDocuments(filters);
  const { data: types = [] } = useDocumentTypes();
  const del = useDeleteDocument();

  const [addOpen, setAddOpen] = useState(false);
  const [editDoc, setEditDoc] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [shareDoc, setShareDoc] = useState(null);

  const onDownload = async (doc) => {
    const blob = await fetchContentBlob(doc.id, 'attachment');
    await downloadBlob(blob, doc.label || 'document');
  };
  const onDelete = (doc) => {
    confirm({ title: 'Delete document?', description: `“${doc.label}” will be permanently deleted.` })
      .then(() => del.mutate(doc.id)).catch(() => {});
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, color: T.textPrimary }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Typography sx={{ fontSize: 22, fontWeight: 800 }}>Document Wallet</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}
          sx={{ bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover } }}>Add document</Button>
      </Box>

      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField size="small" placeholder="Search by label" value={q}
          onChange={(e) => setQ(e.target.value)} sx={{ minWidth: 220 }} />
        <Chip label="All" onClick={() => setTypeId('')} color={typeId === '' ? 'primary' : 'default'} />
        {types.map((t) => (
          <Chip key={t.id} label={t.displayName} onClick={() => setTypeId(t.id)}
            color={typeId === t.id ? 'primary' : 'default'} />
        ))}
      </Box>

      {isLoading ? <CircularProgress sx={{ color: T.teal }} />
        : docs.length === 0 ? <Typography sx={{ color: T.textMuted }}>No documents yet. Add your first one.</Typography>
        : (
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,1fr)', md: 'repeat(3,1fr)' } }}>
            {docs.map((doc) => (
              <DocumentCard key={doc.id} doc={doc}
                onPreview={setPreviewDoc} onDownload={onDownload}
                onEdit={setEditDoc} onShare={setShareDoc} onDelete={onDelete} />
            ))}
          </Box>
        )}

      <AddDocumentDialog open={addOpen} onClose={() => setAddOpen(false)} />
      {editDoc && <EditDocumentDialog docId={editDoc.id} open onClose={() => setEditDoc(null)} />}
      {previewDoc && <DocumentPreviewDialog doc={previewDoc} open onClose={() => setPreviewDoc(null)} />}
      {shareDoc && <ShareDialog doc={shareDoc} open onClose={() => setShareDoc(null)} />}
    </Box>
  );
}
```
  Note: `useConfirm` from `material-ui-confirm` requires the app to be wrapped in its provider. If the app is not already, wrap the page's dialogs with `<ConfirmProvider>` locally, or replace the confirm with a simple MUI dialog. Check how existing admin pages delete (e.g. `admin/users`) and match that pattern.

- [ ] **Step 3: Commit.**
```bash
git add db-world-frontend/src/features/wallet/components/DocumentCard.jsx db-world-frontend/src/features/wallet/index.jsx
git commit -m "feat(wallet-ui): wallet page grid + document card"
```

### Task 7.5: `DocumentPreviewDialog`

**Files:** Create `db-world-frontend/src/features/wallet/components/DocumentPreviewDialog.jsx`

**Interfaces:** Consumes `fetchContentBlob`. Renders inline `<img>`/`<iframe>` from an authenticated blob object-URL; revokes on close.

- [ ] **Step 1: Implement.**
```jsx
import { useEffect, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, IconButton, Box, CircularProgress, Button } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import { useT } from '@shared/theme';
import { fetchContentBlob } from '../api/walletApi';
import { downloadBlob } from '../utils/download';

export default function DocumentPreviewDialog({ doc, open, onClose }) {
  const T = useT();
  const [url, setUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const isPdf = doc.contentType === 'application/pdf';

  useEffect(() => {
    let objectUrl;
    setLoading(true);
    fetchContentBlob(doc.id, 'inline')
      .then((blob) => { objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); })
      .finally(() => setLoading(false));
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [doc.id]);

  const onDownload = async () => {
    const blob = await fetchContentBlob(doc.id, 'attachment');
    await downloadBlob(blob, doc.label || 'document');
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth
      PaperProps={{ sx: { bgcolor: T.sidebar } }}>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: T.textPrimary }}>
        {doc.label}
        <Box>
          <Button startIcon={<DownloadIcon />} onClick={onDownload} sx={{ color: T.teal }}>Download</Button>
          <IconButton onClick={onClose} sx={{ color: T.textFaint }}><CloseIcon /></IconButton>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ minHeight: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {loading ? <CircularProgress sx={{ color: T.teal }} />
          : isPdf ? <iframe title={doc.label} src={url} style={{ width: '100%', height: '70vh', border: 0 }} />
          : <img alt={doc.label} src={url} style={{ maxWidth: '100%', maxHeight: '70vh' }} />}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit.**
```bash
git add db-world-frontend/src/features/wallet/components/DocumentPreviewDialog.jsx
git commit -m "feat(wallet-ui): in-app document preview dialog"
```

### Task 7.6: `EditDocumentDialog`

**Files:** Create `db-world-frontend/src/features/wallet/components/EditDocumentDialog.jsx`

**Interfaces:** Consumes `fetchDocument`, `useUpdateDocument`, `editDocumentSchema`.

- [ ] **Step 1: Implement.**
```jsx
import { useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, IconButton, Grid, TextField, CircularProgress } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useT } from '@shared/theme';
import { editDocumentSchema } from '../schemas/documentSchemas';
import { fetchDocument } from '../api/walletApi';
import { useUpdateDocument } from '../hooks/useWallet';

export default function EditDocumentDialog({ docId, open, onClose }) {
  const T = useT();
  const { data: doc, isLoading } = useQuery({ queryKey: ['wallet', 'document', docId], queryFn: () => fetchDocument(docId) });
  const update = useUpdateDocument();
  const { control, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(editDocumentSchema),
    defaultValues: { label: '', number: '', issueDate: '', expiryDate: '', notes: '' },
  });

  useEffect(() => {
    if (doc) reset({
      label: doc.label ?? '', number: doc.documentNumber ?? '',
      issueDate: doc.issueDate ?? '', expiryDate: doc.expiryDate ?? '', notes: doc.notes ?? '',
    });
  }, [doc, reset]);

  const submit = (v) => update.mutate(
    { id: docId, body: { label: v.label, documentNumber: v.number || null, issueDate: v.issueDate || null, expiryDate: v.expiryDate || null, notes: v.notes || null } },
    { onSuccess: onClose },
  );

  const sx = { '& .MuiInputBase-root': { color: T.textPrimary }, '& label': { color: T.textMuted } };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" PaperProps={{ sx: { bgcolor: T.sidebar } }}>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', color: T.textPrimary }}>
        Edit document <IconButton onClick={onClose} sx={{ color: T.textFaint }}><CloseIcon /></IconButton>
      </DialogTitle>
      {isLoading ? <DialogContent><CircularProgress sx={{ color: T.teal }} /></DialogContent> : (
        <form onSubmit={handleSubmit(submit)}>
          <DialogContent>
            <Grid container spacing={2}>
              <Grid item xs={12}><Controller name="label" control={control} render={({ field }) => (
                <TextField {...field} fullWidth size="small" label="Label" sx={sx}
                  error={!!errors.label} helperText={errors.label?.message} />)} /></Grid>
              <Grid item xs={12}><Controller name="number" control={control} render={({ field }) => (
                <TextField {...field} fullWidth size="small" label="Document number" sx={sx} />)} /></Grid>
              <Grid item xs={6}><Controller name="issueDate" control={control} render={({ field }) => (
                <TextField {...field} fullWidth size="small" type="date" label="Issue date" InputLabelProps={{ shrink: true }} sx={sx} />)} /></Grid>
              <Grid item xs={6}><Controller name="expiryDate" control={control} render={({ field }) => (
                <TextField {...field} fullWidth size="small" type="date" label="Expiry date" InputLabelProps={{ shrink: true }} sx={sx} />)} /></Grid>
              <Grid item xs={12}><Controller name="notes" control={control} render={({ field }) => (
                <TextField {...field} fullWidth size="small" multiline minRows={2} label="Notes" sx={sx} />)} /></Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={onClose} sx={{ color: T.textMuted }}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={update.isPending}
              sx={{ bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover } }}>Save</Button>
          </DialogActions>
        </form>
      )}
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit.**
```bash
git add db-world-frontend/src/features/wallet/components/EditDocumentDialog.jsx
git commit -m "feat(wallet-ui): edit-document dialog"
```

### Task 7.7: `ShareDialog`

**Files:** Create `db-world-frontend/src/features/wallet/components/ShareDialog.jsx`

**Interfaces:** Consumes `createShare`, `fetchShares`, `revokeShare`, `buildShareUrl`.

- [ ] **Step 1: Implement.**
```jsx
import { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, IconButton, TextField, MenuItem,
  Alert, Box, Typography, List, ListItem, ListItemText,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useT } from '@shared/theme';
import { createShare, fetchShares, revokeShare, buildShareUrl } from '../api/walletApi';

const EXPIRY_OPTIONS = [{ label: '1 hour', value: 1 }, { label: '24 hours', value: 24 }, { label: '7 days', value: 168 }];

export default function ShareDialog({ doc, open, onClose }) {
  const T = useT();
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [hours, setHours] = useState(24);
  const [maxViews, setMaxViews] = useState('');
  const [newUrl, setNewUrl] = useState('');

  const { data: shares = [] } = useQuery({ queryKey: ['wallet', 'shares', doc.id], queryFn: () => fetchShares(doc.id) });

  const create = useMutation({
    mutationFn: () => createShare(doc.id, { expiresInHours: hours, maxAccessCount: maxViews ? Number(maxViews) : null }),
    onSuccess: (dto) => { setNewUrl(buildShareUrl(dto.token)); qc.invalidateQueries({ queryKey: ['wallet', 'shares', doc.id] }); },
    onError: (e) => enqueueSnackbar(e?.response?.data?.message ?? 'Failed to create link', { variant: 'error' }),
  });
  const revoke = useMutation({
    mutationFn: (id) => revokeShare(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['wallet', 'shares', doc.id] }); enqueueSnackbar('Link revoked', { variant: 'success' }); },
  });

  const copy = (url) => { navigator.clipboard.writeText(url); enqueueSnackbar('Link copied', { variant: 'success' }); };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" PaperProps={{ sx: { bgcolor: T.sidebar } }}>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', color: T.textPrimary }}>
        Share “{doc.label}” <IconButton onClick={onClose} sx={{ color: T.textFaint }}><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Alert severity="warning">You are sharing a real government document. Anyone with the link can view it until it expires or you revoke it.</Alert>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField select size="small" label="Expires in" value={hours} onChange={(e) => setHours(Number(e.target.value))} sx={{ flex: 1 }}>
            {EXPIRY_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
          </TextField>
          <TextField size="small" label="Max views (optional)" type="number" value={maxViews}
            onChange={(e) => setMaxViews(e.target.value)} sx={{ flex: 1 }} />
        </Box>
        <Button variant="contained" onClick={() => create.mutate()} disabled={create.isPending}
          sx={{ bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover } }}>Create link</Button>

        {newUrl && (
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <TextField size="small" fullWidth value={newUrl} InputProps={{ readOnly: true }} />
            <IconButton onClick={() => copy(newUrl)} sx={{ color: T.teal }}><ContentCopyIcon /></IconButton>
          </Box>
        )}

        <Typography sx={{ fontSize: 12, color: T.textFaint, textTransform: 'uppercase' }}>Active links</Typography>
        <List dense>
          {shares.length === 0 && <Typography sx={{ color: T.textMuted, fontSize: 13 }}>No active links.</Typography>}
          {shares.map((s) => (
            <ListItem key={s.id} secondaryAction={
              <Button size="small" color="error" onClick={() => revoke.mutate(s.id)}>Revoke</Button>}>
              <ListItemText
                primary={`Expires ${new Date(s.expiresAt).toLocaleString()}`}
                secondary={`Views: ${s.accessCount}${s.maxAccessCount ? ` / ${s.maxAccessCount}` : ''}`}
                primaryTypographyProps={{ color: T.textPrimary, fontSize: 13 }}
                secondaryTypographyProps={{ color: T.textFaint, fontSize: 12 }} />
            </ListItem>
          ))}
        </List>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}><Button onClick={onClose} sx={{ color: T.textMuted }}>Close</Button></DialogActions>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit.**
```bash
git add db-world-frontend/src/features/wallet/components/ShareDialog.jsx
git commit -m "feat(wallet-ui): share dialog (create/copy/list/revoke + warning)"
```

### Task 7.8: register user route + home tile

**Files:**
- Modify: `db-world-frontend/src/app/App.jsx`
- Modify: `db-world-frontend/src/shared/components/layout/home/homeData.jsx`

- [ ] **Step 1: Add the lazy import + protected route in `App.jsx`.** Near the other user-page lazies (~L64-72):
```jsx
const LazyWallet = lazy(() => import('@features/wallet'));
```
  and add to `routeConfig.protected` (L188-205):
```jsx
{ path: Constants.DB_WALLET_ROUTE, element: <LazyWallet /> },
```

- [ ] **Step 2: Add the home-launcher tile in `homeData.jsx`.** Add an icon import and an `APPS` entry:
```jsx
// with the other icon imports:
import { AccountBalanceWallet as WalletIcon } from '@mui/icons-material';
```
```jsx
{
  id: 'wallet',
  label: 'Document Wallet',
  description: 'Store Aadhaar, PAN, licence & more',
  Icon: WalletIcon,
  route: Constants.DB_WALLET_ROUTE,
  adminOnly: false,
  accent: '#0d9488',
  gradient: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
},
```

- [ ] **Step 3: Verify via preview.** Start the dev server (`preview_start` with `.claude/launch.json`); log in; from Home click the Document Wallet tile; confirm the page loads at `/db-world/db-wallet`. Use `preview_snapshot` to confirm the heading and "Add document" button render, and `preview_console_logs` (level error) to confirm no errors. Add a test PDF, confirm it appears; preview it; download it; edit it; create a share link; delete it.
- [ ] **Step 4: Commit.**
```bash
git add db-world-frontend/src/app/App.jsx db-world-frontend/src/shared/components/layout/home/homeData.jsx
git commit -m "feat(wallet-ui): register wallet route + home launcher tile"
```

### Task 7.9: public shared-document page

**Files:**
- Create: `db-world-frontend/src/features/wallet/SharedDocumentPage.jsx`
- Modify: `db-world-frontend/src/app/App.jsx` (public route)

**Interfaces:** Consumes `fetchSharedInfo`, `sharedContentUrl`. No auth.

- [ ] **Step 1: Implement `SharedDocumentPage.jsx`.**
```jsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Typography, Button, CircularProgress } from '@mui/material';
import { useT } from '@shared/theme';
import { fetchSharedInfo, sharedContentUrl } from './api/walletApi';

export default function SharedDocumentPage() {
  const T = useT();
  const { token } = useParams();
  const [info, setInfo] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSharedInfo(token)
      .then(setInfo)
      .catch((e) => setError(e?.response?.data?.message ?? 'This link is invalid or has expired.'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress sx={{ color: T.teal }} /></Box>;
  if (error)   return <Box sx={{ p: 4, textAlign: 'center', color: T.textMuted }}><Typography>{error}</Typography></Box>;

  const isPdf = info.contentType === 'application/pdf';
  const inlineUrl = sharedContentUrl(token, 'inline');

  return (
    <Box sx={{ p: { xs: 2, sm: 4 }, color: T.textPrimary, maxWidth: 900, mx: 'auto' }}>
      <Typography sx={{ fontSize: 20, fontWeight: 800 }}>{info.label}</Typography>
      {info.typeDisplayName && <Typography sx={{ color: T.textMuted, mb: 2 }}>{info.typeDisplayName}</Typography>}
      <Box sx={{ my: 2, border: `1px solid ${T.border}`, borderRadius: 2, overflow: 'hidden' }}>
        {isPdf ? <iframe title={info.label} src={inlineUrl} style={{ width: '100%', height: '75vh', border: 0 }} />
               : <img alt={info.label} src={inlineUrl} style={{ maxWidth: '100%' }} />}
      </Box>
      <Button variant="contained" href={sharedContentUrl(token, 'attachment')}
        sx={{ bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover } }}>Download</Button>
    </Box>
  );
}
```

- [ ] **Step 2: Add the public route in `App.jsx`.** Add a lazy import and a `routeConfig.public` entry:
```jsx
const LazySharedDocument = lazy(() => import('@features/wallet/SharedDocumentPage'));
```
```jsx
{ path: Constants.DB_WALLET_SHARE_ROUTE, element: <LazySharedDocument /> },
```

- [ ] **Step 3: Verify via preview.** Create a share link in the wallet, open the built URL's path (`/db-world/shared-doc/<token>`) in the preview while logged out (or in a fresh context); confirm the doc renders and downloads, and that an expired/garbage token shows the friendly error.
- [ ] **Step 4: Commit.**
```bash
git add db-world-frontend/src/features/wallet/SharedDocumentPage.jsx db-world-frontend/src/app/App.jsx
git commit -m "feat(wallet-ui): public shared-document page + route"
```

---

## Phase 8 — Admin frontend (`src/features/admin/wallet/`)

### Task 8.1: admin api + route + nav

**Files:**
- Create: `db-world-frontend/src/features/admin/wallet/adminWalletApi.js`
- Modify: `db-world-frontend/src/app/App.jsx`
- Modify: `db-world-frontend/src/features/admin/layout/AdminLayout.jsx`

- [ ] **Step 1: Create `adminWalletApi.js`.**
```js
import axiosInstance from '@shared/components/ui/utils/AxiosInstants';

const BASE = '/api/admin/wallet';
const unwrap = (r) => r.data?.data ?? r.data;

export const fetchTypes = () => axiosInstance.get(`${BASE}/types`).then(unwrap);
export const createType = (body) => axiosInstance.post(`${BASE}/types`, body).then(unwrap);
export const updateType = (id, body) => axiosInstance.put(`${BASE}/types/${id}`, body).then(unwrap);
export const deleteType = (id) => axiosInstance.delete(`${BASE}/types/${id}`).then((r) => r.data);
export const fetchStats = () => axiosInstance.get(`${BASE}/stats`).then(unwrap);

// max-size / allowed-types live in the shared app_config surface:
export const fetchConfig = () => axiosInstance.get('/api/admin/config').then(unwrap);
export const updateConfig = (key, value) => axiosInstance.put(`/api/admin/config/${encodeURIComponent(key)}`, { value }).then(unwrap);
```

- [ ] **Step 2: Add the admin child route in `App.jsx`.** Add a lazy import near the admin lazies (~L50-63) and a `<Route>` inside the `AdminLayout` block (L368-391):
```jsx
const LazyWalletAdmin = lazy(() => import('@features/admin/wallet'));
```
```jsx
<Route path="document-wallet" element={<LazyWalletAdmin />} />
```

- [ ] **Step 3: Add the nav item in `AdminLayout.jsx`.** Import an icon and add an item to the `system` (or `content`) section's `items`:
```jsx
// with the icon imports:
import { AccountBalanceWallet } from '@mui/icons-material';
```
```jsx
{ id: 'document-wallet', label: 'Document Wallet', icon: <AccountBalanceWallet />, path: 'document-wallet' },
```

- [ ] **Step 4: Commit.**
```bash
git add db-world-frontend/src/features/admin/wallet/adminWalletApi.js \
        db-world-frontend/src/app/App.jsx db-world-frontend/src/features/admin/layout/AdminLayout.jsx
git commit -m "feat(wallet-admin): admin api + route + sidebar nav"
```

### Task 8.2: admin page shell + Document Types tab

**Files:**
- Create: `db-world-frontend/src/features/admin/wallet/index.jsx`
- Create: `db-world-frontend/src/features/admin/wallet/DocumentTypesTab.jsx`
- Create: `db-world-frontend/src/features/admin/wallet/typeSchemas.js`
- Create: `db-world-frontend/src/features/admin/wallet/TypeUpsertDialog.jsx`

- [ ] **Step 1: Create `typeSchemas.js`.**
```js
import { z } from 'zod';

export const typeSchema = z.object({
  code: z.string().min(2, 'Min 2 chars').max(40).regex(/^[A-Z0-9_]+$/i, 'Letters, digits, underscore only'),
  displayName: z.string().min(2, 'Min 2 chars').max(100),
  description: z.string().max(300).optional().or(z.literal('')),
  numberLabel: z.string().max(60).optional().or(z.literal('')),
  requiresNumber: z.boolean().default(false),
  active: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).default(0),
});
```

- [ ] **Step 2: Create `TypeUpsertDialog.jsx`.**
```jsx
import { useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, IconButton, Grid, TextField, FormControlLabel, Switch, Controller as _c } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useT } from '@shared/theme';
import { typeSchema } from './typeSchemas';
import { createType, updateType } from './adminWalletApi';

export default function TypeUpsertDialog({ open, onClose, editItem }) {
  const T = useT();
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const { control, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(typeSchema),
    defaultValues: { code: '', displayName: '', description: '', numberLabel: '', requiresNumber: false, active: true, sortOrder: 0 },
  });
  useEffect(() => { if (editItem) reset(editItem); else reset({ code: '', displayName: '', description: '', numberLabel: '', requiresNumber: false, active: true, sortOrder: 0 }); }, [editItem, reset]);

  const mut = useMutation({
    mutationFn: (v) => (editItem ? updateType(editItem.id, v) : createType(v)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['wallet-admin', 'types'] }); enqueueSnackbar('Saved', { variant: 'success' }); onClose(); },
    onError: (e) => enqueueSnackbar(e?.response?.data?.message ?? 'Failed to save', { variant: 'error' }),
  });
  const sx = { '& .MuiInputBase-root': { color: T.textPrimary }, '& label': { color: T.textMuted } };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" PaperProps={{ sx: { bgcolor: T.sidebar } }}>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', color: T.textPrimary }}>
        {editItem ? 'Edit document type' : 'New document type'}
        <IconButton onClick={onClose} sx={{ color: T.textFaint }}><CloseIcon /></IconButton>
      </DialogTitle>
      <form onSubmit={handleSubmit((v) => mut.mutate(v))}>
        <DialogContent>
          <Grid container spacing={2}>
            <Grid item xs={6}><Controller name="code" control={control} render={({ field }) => (
              <TextField {...field} fullWidth size="small" label="Code" sx={sx} error={!!errors.code} helperText={errors.code?.message} />)} /></Grid>
            <Grid item xs={6}><Controller name="displayName" control={control} render={({ field }) => (
              <TextField {...field} fullWidth size="small" label="Display name" sx={sx} error={!!errors.displayName} helperText={errors.displayName?.message} />)} /></Grid>
            <Grid item xs={12}><Controller name="description" control={control} render={({ field }) => (
              <TextField {...field} fullWidth size="small" label="Description" sx={sx} />)} /></Grid>
            <Grid item xs={6}><Controller name="numberLabel" control={control} render={({ field }) => (
              <TextField {...field} fullWidth size="small" label="Number label" sx={sx} />)} /></Grid>
            <Grid item xs={6}><Controller name="sortOrder" control={control} render={({ field }) => (
              <TextField {...field} fullWidth size="small" type="number" label="Sort order" sx={sx} />)} /></Grid>
            <Grid item xs={6}><Controller name="requiresNumber" control={control} render={({ field }) => (
              <FormControlLabel control={<Switch checked={field.value} onChange={field.onChange} />} label="Requires number" sx={{ color: T.textMuted }} />)} /></Grid>
            <Grid item xs={6}><Controller name="active" control={control} render={({ field }) => (
              <FormControlLabel control={<Switch checked={field.value} onChange={field.onChange} />} label="Active" sx={{ color: T.textMuted }} />)} /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} sx={{ color: T.textMuted }}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={mut.isPending} sx={{ bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover } }}>Save</Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
```
  (Remove the stray `Controller as _c` import — it was a typo; import `Controller` only from `react-hook-form`.)

- [ ] **Step 3: Create `DocumentTypesTab.jsx`** (DataGrid + upsert + delete).
```jsx
import { useState } from 'react';
import { Box, Button, Chip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { DataGrid } from '@mui/x-data-grid';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useConfirm } from 'material-ui-confirm';
import { useSnackbar } from 'notistack';
import { useT } from '@shared/theme';
import { fetchTypes, deleteType } from './adminWalletApi';
import TypeUpsertDialog from './TypeUpsertDialog';

export default function DocumentTypesTab() {
  const T = useT();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { enqueueSnackbar } = useSnackbar();
  const { data: types = [], isLoading } = useQuery({ queryKey: ['wallet-admin', 'types'], queryFn: fetchTypes });
  const [dialog, setDialog] = useState({ open: false, item: null });
  const del = useMutation({
    mutationFn: (id) => deleteType(id),
    onSuccess: (res) => { qc.invalidateQueries({ queryKey: ['wallet-admin', 'types'] }); enqueueSnackbar(res?.message ?? 'Done', { variant: 'success' }); },
  });

  const columns = [
    { field: 'code', headerName: 'Code', width: 160 },
    { field: 'displayName', headerName: 'Name', flex: 1 },
    { field: 'requiresNumber', headerName: 'Number?', width: 110, renderCell: (p) => (p.value ? 'Yes' : 'No') },
    { field: 'active', headerName: 'Active', width: 110, renderCell: (p) => (
      <Chip size="small" label={p.value ? 'Active' : 'Inactive'} color={p.value ? 'success' : 'default'} />) },
    { field: 'sortOrder', headerName: 'Order', width: 90 },
    { field: 'actions', headerName: '', width: 160, sortable: false, renderCell: (p) => (
      <>
        <Button size="small" onClick={() => setDialog({ open: true, item: p.row })}>Edit</Button>
        <Button size="small" color="error" onClick={() =>
          confirm({ title: 'Delete type?', description: 'In-use types are deactivated instead.' })
            .then(() => del.mutate(p.row.id)).catch(() => {})}>Delete</Button>
      </>) },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
        <Button startIcon={<AddIcon />} variant="contained" onClick={() => setDialog({ open: true, item: null })}
          sx={{ bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover } }}>New type</Button>
      </Box>
      <div style={{ height: 480 }}>
        <DataGrid rows={types} columns={columns} loading={isLoading} getRowId={(r) => r.id}
          disableRowSelectionOnClick density="compact" />
      </div>
      <TypeUpsertDialog open={dialog.open} editItem={dialog.item} onClose={() => setDialog({ open: false, item: null })} />
    </Box>
  );
}
```

- [ ] **Step 4: Create the page shell `index.jsx`** (tabs).
```jsx
import { useState } from 'react';
import { Box, Tabs, Tab, Typography } from '@mui/material';
import { useT } from '@shared/theme';
import DocumentTypesTab from './DocumentTypesTab';
import MonitorTab from './MonitorTab';

export default function WalletAdminPage() {
  const T = useT();
  const [tab, setTab] = useState(0);
  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, color: T.textPrimary }}>
      <Typography sx={{ fontSize: 20, fontWeight: 800, mb: 1 }}>Document Wallet</Typography>
      <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Document Types" />
        <Tab label="Monitor" />
      </Tabs>
      {tab === 0 ? <DocumentTypesTab /> : <MonitorTab />}
    </Box>
  );
}
```

- [ ] **Step 5: Commit.**
```bash
git add db-world-frontend/src/features/admin/wallet/index.jsx \
        db-world-frontend/src/features/admin/wallet/DocumentTypesTab.jsx \
        db-world-frontend/src/features/admin/wallet/TypeUpsertDialog.jsx \
        db-world-frontend/src/features/admin/wallet/typeSchemas.js
git commit -m "feat(wallet-admin): document types tab (grid + upsert + delete)"
```

### Task 8.3: Monitor tab (stats + settings)

**Files:** Create `db-world-frontend/src/features/admin/wallet/MonitorTab.jsx`

**Interfaces:** Consumes `fetchStats`, `fetchConfig`, `updateConfig`. Aggregate-only stats + editable max-size/allowed-types.

- [ ] **Step 1: Implement.**
```jsx
import { useMemo, useState, useEffect } from 'react';
import { Box, Typography, TextField, Button, Skeleton } from '@mui/material';
import { BarChart } from '@mui/x-charts/BarChart';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useT, useThemeMode } from '@shared/theme';
import { fetchStats, fetchConfig, updateConfig } from './adminWalletApi';

const fmtBytes = (b) => b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB`
  : b < 1073741824 ? `${(b / 1048576).toFixed(1)} MB` : `${(b / 1073741824).toFixed(2)} GB`;

function StatCard({ T, label, value }) {
  return (
    <Box sx={{ bgcolor: T.glass, border: `1px solid ${T.border}`, borderRadius: 2, p: 2, flex: 1, minWidth: 160 }}>
      <Typography sx={{ fontSize: 11, color: T.textFaint, textTransform: 'uppercase' }}>{label}</Typography>
      <Typography sx={{ fontSize: 22, fontWeight: 800, color: T.textPrimary }}>{value}</Typography>
    </Box>
  );
}

export default function MonitorTab() {
  const T = useT();
  const { mode } = useThemeMode();
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const { data: stats, isLoading } = useQuery({ queryKey: ['wallet-admin', 'stats'], queryFn: fetchStats });
  const { data: config = [] } = useQuery({ queryKey: ['app-config'], queryFn: fetchConfig });

  // find the two wallet settings across the grouped config payload
  const flat = useMemo(() => (Array.isArray(config) ? config.flatMap((c) => c.settings ?? []) : []), [config]);
  const maxSizeSetting = flat.find((s) => s.key === 'wallet.max-file-size-bytes');
  const [maxSize, setMaxSize] = useState('');
  useEffect(() => { if (maxSizeSetting) setMaxSize(maxSizeSetting.value ?? maxSizeSetting.defaultValue); }, [maxSizeSetting]);

  const saveConfig = useMutation({
    mutationFn: ({ key, value }) => updateConfig(key, value),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['app-config'] }); enqueueSnackbar('Setting saved', { variant: 'success' }); },
    onError: (e) => enqueueSnackbar(e?.response?.data?.message ?? 'Failed to save', { variant: 'error' }),
  });

  const perType = stats?.perType ?? [];
  const axisColor = mode === 'dark' ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.55)';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        {isLoading ? <Skeleton variant="rounded" height={80} width={480} /> : (
          <>
            <StatCard T={T} label="Documents" value={stats?.totalDocuments ?? 0} />
            <StatCard T={T} label="Storage used" value={fmtBytes(stats?.totalStorageBytes ?? 0)} />
            <StatCard T={T} label="Active shares" value={stats?.activeShares ?? 0} />
          </>
        )}
      </Box>

      <Box sx={{ bgcolor: T.glass, border: `1px solid ${T.border}`, borderRadius: 2, p: 2 }}>
        <Typography sx={{ fontSize: 11, color: T.textFaint, textTransform: 'uppercase', mb: 1 }}>Documents by type</Typography>
        {perType.length === 0 ? <Typography sx={{ color: T.textMuted, fontSize: 13 }}>No documents yet.</Typography> : (
          <BarChart height={260}
            xAxis={[{ scaleType: 'band', data: perType.map((t) => t.displayName) }]}
            series={[{ data: perType.map((t) => t.count), color: '#0d9488' }]}
            sx={{ '.MuiChartsAxis-tickLabel': { fill: axisColor, fontSize: 10 } }} />
        )}
      </Box>

      <Box sx={{ bgcolor: T.glass, border: `1px solid ${T.border}`, borderRadius: 2, p: 2, display: 'flex', gap: 1, alignItems: 'center' }}>
        <TextField size="small" label="Max file size (bytes)" type="number" value={maxSize}
          onChange={(e) => setMaxSize(e.target.value)} sx={{ maxWidth: 240 }} />
        <Button variant="contained" onClick={() => saveConfig.mutate({ key: 'wallet.max-file-size-bytes', value: String(maxSize) })}
          sx={{ bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover } }}>Save</Button>
        <Typography sx={{ fontSize: 12, color: T.textFaint }}>
          Allowed types and other settings are on the Settings page.
        </Typography>
      </Box>
    </Box>
  );
}
```

- [ ] **Step 2: Verify via preview.** As an admin, open `/db-world/admin/document-wallet`; confirm the Document Types grid lists the 6 seeded types, create/edit/deactivate a type, switch to Monitor and confirm counts/storage/chart render and that changing max-size persists (re-open Settings page to confirm). Confirm no console errors.
- [ ] **Step 3: Commit.**
```bash
git add db-world-frontend/src/features/admin/wallet/MonitorTab.jsx
git commit -m "feat(wallet-admin): monitor tab (aggregate stats + max-size setting)"
```

---

## Phase 9 — Android touch-ups (built locally by the user)

> The Capacitor webview runs the same React feature. This phase only adds native download/preview handling. **The Android app cannot be compiled in this environment** — the user builds and tests it locally per the project's Android notes.

### Task 9.1: native blob download

**Files:** Create `db-world-frontend/src/platform/android/walletDownload.js`

**Interfaces:** Produces `saveBlobNative(blob, filename)` (dynamically imported by `utils/download.js` on native).

- [ ] **Step 1: Implement using Capacitor Filesystem + Share.**
```js
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

const blobToBase64 = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onloadend = () => resolve(String(reader.result).split(',')[1]);
  reader.onerror = reject;
  reader.readAsDataURL(blob);
});

/** Writes the blob to the device Documents dir and opens the share sheet. */
export async function saveBlobNative(blob, filename) {
  const data = await blobToBase64(blob);
  const safeName = filename.replace(/[^\w.\-]+/g, '_') || 'document';
  const result = await Filesystem.writeFile({ path: safeName, data, directory: Directory.Documents, recursive: true });
  try {
    await Share.share({ title: safeName, url: result.uri });
  } catch (_ignored) { /* user dismissed share sheet */ }
  return result.uri;
}
```
  Note: confirm `@capacitor/share` is a dependency; if not, install it (`npm i @capacitor/share`) or drop the Share call and just write the file. `@capacitor/filesystem` is already used in the project.

- [ ] **Step 2: Handoff.** Build the Android app locally (`publish-android.ps1` / Android Studio per project notes) and verify: add a document, preview (image inline; PDF opens via viewer/external), download saves to Documents. This step is executed on the user's machine — mark complete after the user confirms.
- [ ] **Step 3: Commit.**
```bash
git add db-world-frontend/src/platform/android/walletDownload.js
git commit -m "feat(wallet-ui): native (Android) blob download via Capacitor Filesystem"
```

---

## Phase 10 — End-to-end verification & docs

### Task 10.1: full-flow verification + runtime docs

- [ ] **Step 1: Backend green.** Run: `cd db-world-backend && "$MVN" -q test` — Expected: all tests pass (wallet + settings + existing suites).
- [ ] **Step 2: Frontend build.** Run: `cd db-world-frontend && npm run build` — Expected: build succeeds with no errors.
- [ ] **Step 3: End-to-end via preview tools** (backend running locally with a dev `WALLET_ENCRYPTION_KEY` or Jasypt fallback):
  - As a normal user: add PDF + image documents → list shows masked numbers → preview both → download both → edit metadata → create a share link → open the share link (logged out) → revoke it → confirm revoked link now errors → delete a document.
  - As admin: manage document types; confirm Monitor shows correct counts/storage; change max-size and confirm a too-large upload is rejected by the server with the message.
  - Confirm a second user cannot see the first user's documents (log in as another account → empty wallet).
- [ ] **Step 4: Runtime docs.** Add a short note to the runtime env docs (e.g. `../runtime/backend.env` template or `README`) documenting `WALLET_ENCRYPTION_KEY` (base64 32 bytes) and the **back-it-up** warning. Commit.
```bash
git add -A && git commit -m "docs(wallet): document WALLET_ENCRYPTION_KEY in runtime env notes"
```
- [ ] **Step 5: Finish the branch.** Use the `superpowers:finishing-a-development-branch` skill to decide merge/PR. Do not merge to `development` until the user confirms end-to-end behaviour.

---

## Self-Review Notes (author)

- **Spec coverage:** per-user isolation (Tasks 4.1/4.2 owner-scoped, 404), AES-GCM at rest (1.1), column-encrypted number/notes (2.2), minimal add form (7.3), admin-managed seeded types (3.3, 8.2), aggregate-only monitor (3.4, 8.3), 10 MB admin-editable cap (0.1, 4.1, 8.3), PDF/JPEG/PNG + magic-byte sniff (4.1), preview (7.5), download (7.4/7.5), edit (7.6), delete (4.1/7.4), share create/list/revoke + public page (5.x, 7.7, 7.9), Android (9.1) — all mapped.
- **Key separation** is honored: wallet key is dedicated (`WALLET_ENCRYPTION_KEY`), distinct from Jasypt (number/notes) and the CDN HMAC secret.
- **Known follow-ups to verify during execution (not blocking):** (a) confirm `publicShareUrl()` returns the web origin for `buildShareUrl`; (b) confirm `material-ui-confirm` provider is mounted app-wide (else use a local `<ConfirmProvider>` or a plain dialog); (c) confirm `@capacitor/share` dependency for Phase 9.
