# Vault: safety, portability, Android autofill and passkeys: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the password vault safe to lose things from, portable, and usable from other apps: trash, history, typed fields, secrets fetched on demand, organisation, import/export, breach flags, Android autofill with save-from-site, and passkeys.

**Architecture:** Five phases, each shippable on its own. Phases 1-3 are Spring Boot + React changes to `app/pm` and `features/password-manager`. Phases 4-5 are native Android (Kotlin) behind Capacitor plugins. Secrets stay encrypted at rest by `StringCryptoConverter` on the server and by AndroidKeyStore on the device.

**Tech Stack:** Spring Boot 4 / Java 25, MapStruct, JPA (`ddl-auto: update`, manual SQL in `db-world-backend/src/main/resources/db/migration/`), React 18 + MUI 7 + TanStack Query + RHF/Zod, Vitest, Capacitor 6 Android (Kotlin 1.9.20, minSdk 23, compileSdk 35), `androidx.biometric`.

**Spec:** Section "Decisions" below (this document). No separate spec exists; the decisions were made in conversation on 2026-10-24.

## Decisions

- **Out of scope:** TOTP codes; zero-knowledge (client-side) encryption.
- **CSV export is wanted** (decided 2026-10-24), behind a confirmation and re-authentication.
- **Execution style: subagent-driven for every phase** (best output; chosen 2026-10-24).
- **Passkeys are device-local first.** The server holds the encryption key, so syncing passkey private keys through it would let the server read them. Syncing is a later, separate decision.
- **Save-from-site on Android opens the web add form prefilled** instead of calling the API natively. The JWT lives in the WebView, so this avoids giving native code a token.
- **Autofill needs its own native encrypted store.** The offline cache is in the WebView's IndexedDB and a native `AutofillService` cannot read it.
- **Flyway is adopted (2026-10-24), so nobody runs SQL by hand any more.** Versioned files `V<n>__<what>.sql` in `db-world-backend/src/main/resources/db/migration/` run at startup, before Hibernate. The existing production database is baselined as V1 on its first start; V2 is the vault change. `ddl-auto: update` stays for now. Tested against real MySQL 8.0.39 on a fresh database, a production-like one and a restart (see "Migrations" in Global Constraints). Every phase that changes the schema ships one `.sql` file with a "before deploy" and "after first start" section, like `vault_entries_name_type_optional_site.sql`.
- **No Claude co-author trailer in commits.** Branch: work on `development` only, one commit per task, no push until asked.

## Global Constraints

- Java 25 idioms; MapStruct for DTO/entity mapping, never hand-written mappers.
- Every secret column uses `@Convert(converter = StringCryptoConverter.class)`. Never log a password, PIN, note or custom-field value (log ids only).
- `String.equals(enum)` compiles and is always false: compare enums with `==`.
- Frontend: TanStack Query, RHF + Zod, MUI; use `useT()` inside the component body, never a module-level theme object.
- Every `.ps1` stays ASCII.
- **Migrations (Flyway).** The next free number is V3. One file per change, named `V<n>__snake_case.sql` (two underscores; `validate-migration-naming` fails the start on a typo). Flyway runs *before* Hibernate, so every statement must be safe on a database that does not have the table yet (fresh install: Hibernate creates it afterwards) and on one that already has the change: write each step as "run this only if needed" with the `information_schema` + `PREPARE` pattern in `V2__vault_entries_name_type_optional_site.sql`. Never edit a file that has been released: add a new version. Enum columns that may gain values are `@JdbcTypeCode(SqlTypes.VARCHAR)`, never MySQL ENUMs. Tests run with `spring.flyway.enabled=false` (H2); anything a migration does is verified against a real MySQL (a throwaway local `mysqld` works).
- Backend verify: `cd db-world-backend && "$MVN" test -q -Dtest=<Class>` (MVN path is in CLAUDE.md). Frontend verify: `cd db-world-frontend && npx vitest run <path>` and `npx eslint src/features/password-manager`.
- `package-lock.json` is never regenerated on Windows.

## Review Focus

1. **Old rows.** Entries saved before a phase's columns exist have `null` in them (no name, no type, no field type). Every reader treats `null` as the default. Pinned in Tasks 1.1, 1.3.
2. **Restoring onto a duplicate.** A trashed entry restored after a live entry with the same site, name and username was added must be refused, not create two. Pinned in Task 1.2.
3. **Reading someone else's secret.** `revealSecret` with another user's credential id returns 404, never the value. Pinned in Task 2.1.
4. **Hostile CSV.** Quotes, embedded newlines, a BOM, 50,000 rows, and a row with no password must import the good rows and report the bad ones without a 500. Pinned in Task 3.3.
5. **Look-alike domains.** Autofill must never fill `paypal.com.evil.io` or `evilpaypal.com` with the `paypal.com` login. Pinned in Task 4.2.

## Model per task (used by the execution section)

| Phase | Model | Why |
|---|---|---|
| 0 | Haiku 5.5 (0.1); Opus 5.5 (0.2) | 0.1 is one small file; 0.2 is a diagnosis. |
| 1 | Sonnet 5.5 | Clear requirements, ordinary CRUD. |
| 2 | Opus 5.5 | Changes what the server sends; a mistake leaks secrets. |
| 3 | Sonnet 5.5 (3.4 URL encryption: Opus 5.5) | Features, except the one data migration. |
| 4 | Opus 5.5 | Native security code, hard to test off-device. |
| 5 | Opus 5.5 (Fable 5.1 for the spike in 5.1 if available) | Least documented, highest cost of being wrong. |

---

## Phase 0: Execution tooling

### Task 0.1: `/vault-phase` command that picks the model

**Files:**
- Create: `.claude/skills/vault-phase/SKILL.md`

**Interfaces:**
- Produces: a project skill `vault-phase` taking one argument, a phase number 0-5.

- [x] **Step 1: Write the skill.** Done 2026-10-24: `.claude/skills/vault-phase/SKILL.md`. Besides picking the model it refuses to start when the session's model is cheaper than the phase needs, when another `vault-phase-*` session is still running (they share this checkout), when an earlier phase is open, or when the tree is dirty.
- [x] **Step 2: Verify.** Checked by reading only: skills load when a session starts, so the first real run is `/vault-phase 1` in a new session. Expected there: from an Opus session it starts `vault-phase-1` on Sonnet 5.5; from a Sonnet session `/vault-phase 2` stops with the "switch model" message.
- [x] **Step 3: Commit.** `chore(vault): /vault-phase command that starts a phase on the model it needs`

### Task 0.2: Offline vault and wallet show "failed to load" in flight mode

Reported 2026-10-24: with the phone in flight mode, the vault says it failed to load and lists zero sites; the wallet behaves the same. This must be understood before Phase 2, which changes what the offline snapshot contains.

**Files (read first, change only what the diagnosis points at):**
- `db-world-frontend/src/features/password-manager/offline/vaultCache.js`, `ViewPassword.js` (the `pm-vault` query), `PasswordManagement.js:187`
- `db-world-frontend/src/features/wallet/offline/walletCache.js`, `features/wallet/hooks/useWallet.js`
- `db-world-frontend/android/app/src/main/java/com/db/dbworld/vaultcrypto/VaultCryptoPlugin.java`

**Interfaces:**
- Consumes: `cacheVault(userId, vault)`, `readOfflineVault(userId): { status: 'ok'|'locked'|'invalidated'|'none'|'error' }`, `cacheWallet`, `readOfflineWallet`.
- Produces: a written root cause in this section, then a fix with a test that reproduces it.

Read-only findings so far (code reviewed, device not):
- The snapshot is written only after a successful online load of the vault list page (`ViewPassword.js`'s query). If that page was never opened online on a build that has this code, there is no snapshot and the result is `none`, which the page shows as "failed to load, 0 sites".
- Memory notes say the native side of this feature "was never compiled / device-tested", so the installed APK may simply predate it.
- `capacitor.config.json` uses `androidScheme: "https"` and bundles `dist`, so `crypto.subtle` and IndexedDB are available; that is not the cause.
- The vault reads its user id from `auth.user`, the wallet from `getStoredUser()`; if the optimistic auth state has no user id when offline, the vault returns `none` while the wallet might not.

Desk findings, 2026-10-24 (second pass):
- Releases v3.0.34 to v3.0.38 all contain the offline code (`225d4783`), so an old APK is only the cause if the phone runs an older version.
- The vault and the wallet both go through the same native `VaultCrypto.wrapKey` / `unwrapKey`, and both swallow every error, so one native fault breaks both the same way. That fits the report better than a per-feature bug.
- **Prime suspect: an RSA-OAEP parameter mismatch.** `wrapKey` encrypts with the certificate's public key, so a normal provider does it; `unwrapKey` decrypts inside AndroidKeyStore. The transformation `RSA/ECB/OAEPWithSHA-256AndMGF1Padding` does not pin the MGF1 digest: Keystore uses SHA-1 for MGF1, a normal provider may use SHA-256. If they differ, every snapshot is written and none can be opened. The fix is to pass `new OAEPParameterSpec("SHA-256", "MGF1", MGF1ParameterSpec.SHA1, PSource.PSpecified.DEFAULT)` to `cipher.init` in both methods; old snapshots then fail once, are wiped, and are rewritten on the next online load. Not yet reproduced on a device.
- **The question that splits the two causes:** in flight mode, did a fingerprint / PIN prompt appear before "failed to load"? *Prompt, then failure* means the snapshot exists and decrypting it failed (the OAEP suspect, or `DECRYPT_FAILED` for another reason). *No prompt* means there is no snapshot (status `none`): old APK, never opened online, or no user id.

**Root cause, confirmed 2026-10-24 on the user's phone (Galaxy S24 FE, Android 16, app v3.0.38) from `adb logcat`:** the snapshots exist and the unlock prompt succeeds, then the RSA unwrap fails inside Keystore for both features: `keystore2: Finish failed for AppUid(10555) ... Error::Km(UNKNOWN_ERROR)` at the vault prompt and again at the wallet prompt. That is the OAEP parameter mismatch above. A second, separate bug made the hub show zeros: it registered its own online-only function on `['pm-vault']`, so it never tried the offline copy, and a list opened while that request was failing waited on it. Also seen, not yet looked at: two `VERIFICATION_FAILED` errors on a StrongBox key during the app-launch lock at 20:01:29 (the lock still let the user in).

**Fix:** `VaultCryptoPlugin` passes an explicit `OAEPParameterSpec("SHA-256", "MGF1", MGF1ParameterSpec.SHA1, PSource.PSpecified.DEFAULT)` to both `cipher.init` calls; `useVault.js` is the one query (and offline state) used by the hub, the list and the add form (`useVault.test.js`, 6 tests). Existing snapshots were written with the wrong parameters, so the first offline open after updating fails once; any online visit rewrites them.

- [x] **Step 0: Diagnosed with `adb logcat -d` after reproducing with the internet cut (flight mode drops USB debugging on this phone).**
- [x] **Step 1 (superseded by Step 0): On the phone, with the device online, open the app and the vault list once. Then connect the phone by USB and open `chrome://inspect` to inspect the app's WebView. Record, in this section:** (a) `Capacitor.isPluginAvailable('VaultCrypto')`, (b) whether Application > IndexedDB > `dbworld` > `vaultCache` has a record, (c) the output of `await (await import('/src/features/password-manager/offline/vaultCache.js')).readOfflineVault(<your user id>)` or the equivalent call from the console, (d) the installed app's version name against the latest commit that touched `vaultcrypto/`.
- [x] **Step 2: Write a failing test that reproduces the cause.** Done for the hub (`useVault.test.js`: the fallback, cancelled and invalidated unlocks, no copy). The OAEP fix has no automated test: Keystore only exists on a device; it is checked by compiling the release Java (`compileReleaseJavaWithJavac`, passed) and by Step 4. If (a) is false: the APK needs a rebuild; the test is that `offlineVaultSupported()` is true on Android once the plugin is registered. If (b) is empty: the test is that opening the vault online writes a snapshot (`cacheVault` is called with the list and the user id). If the user id is missing offline: the test is that `userId` falls back to `getStoredUser()` as the wallet does.
- [x] **Step 3: Fix, run the test and the password-manager and wallet suites, expect PASS.** 28 password-manager tests pass, ESLint clean.
- [ ] **Step 4: Verify on the device in flight mode:** vault list shows the saved entries after the unlock prompt; the wallet lists its documents. Commit `fix(vault): offline vault and wallet open in flight mode`.

---

## Phase 1: Never lose data, and say what a field is

### Task 1.1: Custom-field types

**Files:**
- Create: `db-world-backend/src/main/java/com/db/dbworld/app/pm/entity/CustomFieldType.java`
- Modify: `.../pm/entity/CustomFieldEntity.java`, `.../pm/dto/CustomFieldDto.java`
- Create: `db-world-backend/src/main/resources/db/migration/V3__vault_field_types.sql`
- Modify: `db-world-frontend/src/features/password-manager/AddPassword.js`, `ViewPassword.js`
- Create: `db-world-frontend/src/features/password-manager/FieldValue.jsx`
- Test: `db-world-backend/src/test/java/com/db/dbworld/app/pm/service/PasswordManagerServiceImplTest.java`, `db-world-frontend/src/features/password-manager/entryUtils.test.js`

**Interfaces:**
- Produces: `enum CustomFieldType { HIDDEN, TEXT, URL, MULTILINE }`; `CustomFieldEntity.fieldType` and `CustomFieldDto.fieldType` (`@Enumerated(STRING)`, column `field_type VARCHAR(16)`, `null` means `HIDDEN`); frontend `<FieldValue field={{fieldKey, fieldValue, fieldType}} onCopy={fn} />` and `export const isSecretField = (f) => f.fieldType == null || f.fieldType === 'HIDDEN' || f.fieldType === 'MULTILINE'` in `entryUtils.js`.

- [x] **Step 1: Write failing tests.** Service: `aCustomFieldWithoutATypeIsSavedAsHidden` (add with `fieldType=null`, assert the stored field reads `HIDDEN` through `toDto`). Frontend: `isSecretField` is true for `HIDDEN`, `MULTILINE`, `null`, and false for `TEXT`, `URL`.
- [x] **Step 2: Run both; expect FAIL** (`CustomFieldType` not defined; `isSecretField` not exported).
- [x] **Step 3: Implement** the enum, the column and DTO field (default applied in `PasswordManagerServiceImpl.addCredential`/`updateCredential` when null), the migration (V3: add `field_type VARCHAR(16)` to `credential_custom_fields` only if the table exists and lacks it, then backfill `HIDDEN` where null), and `isSecretField`.
- [x] **Step 4: UI.** Each custom-field row in `AddPassword.js` and `EditCustomFieldRow` gets a small select (Hidden/Text/URL/Multi-line). `FieldValue.jsx` renders: HIDDEN masked + show + copy; TEXT plain + copy; URL as a link opening in a new tab with `rel="noopener noreferrer"` + copy; MULTILINE in a `pre-wrap` monospace box, collapsed to 3 lines with "show all", masked until shown, + copy. `CredentialCard` uses it in place of `SecretValueRow` for custom fields.
- [x] **Step 5: Run tests and lint; expect PASS and no ESLint output.** Commit `feat(vault): custom fields have a type: hidden, text, URL, multi-line`.

### Task 1.2: Trash

**Files:**
- Modify: `.../pm/entity/CredentialEntity.java`, `.../pm/repository/CredentialsRepository.java`, `PasswordManagerRepository.java`, `.../pm/service/PasswordManagerService.java` + `impl`, `PasswordManagerController.java`
- Create: `.../pm/service/impl/TrashPurgeJob.java`, `db-world-backend/src/main/resources/db/migration/V4__vault_trash.sql`
- Create: `db-world-frontend/src/features/password-manager/VaultTrash.js`
- Modify: `ViewPassword.js`, `ApiServices.js`, `app/App.jsx` (route), `PasswordManagement.js` (link)
- Test: `PasswordManagerServiceImplTest.java`

**Interfaces:**
- Produces: `CredentialEntity.deletedAt: Instant` (nullable; non-null = in trash); service `void trashCredential(String credentialId)`, `void trashPasswordManager(String pmId)`, `List<PasswordManagerDto> listTrash()`, `void restore(String credentialId)` (throws `DbWorldException(409)` on duplicate), `void purge(String credentialId)`; endpoints `DELETE /api/pm/credential/{id}` and `DELETE /api/pm/{pmId}` now soft-delete, `GET /api/pm/trash`, `POST /api/pm/trash/{id}/restore`, `DELETE /api/pm/trash/{id}`; frontend `getTrash()`, `restoreCredential(id)`, `purgeCredential(id)`.

- [x] **Step 1: Write failing tests.** `deleteMovesTheEntryToTrashInsteadOfRemovingIt`; `trashedEntriesAreNotInTheVaultList`; `aTrashedEntryDoesNotCountAsADuplicate`; `restoringOntoALiveDuplicateIsRefusedWith409` (Review Focus 2); `deletingASiteTrashesEveryCredentialOnIt`; `purgeJobRemovesEntriesTrashedMoreThan30DaysAgo` (inject a `Clock`).
- [x] **Step 2: Run; expect FAIL.**
- [x] **Step 3: Implement.** Soft delete filters via `deletedAt IS NULL` in `getPasswordManagerByUser`, `findAllBy...` duplicate lookups and `getCredentialById`. `TrashPurgeJob` follows the existing scheduler pattern (look at how `ipo` and `tally` jobs register and write run logs) and runs daily. Migration V4: add `deleted_at DATETIME(6) NULL` to `credentials` (guarded), plus an index on it. Done 2026-10-24: the scheduler job is seeded in code (`SchedulerAdminService.DEFAULTS`, id `VaultTrashPurge`, 04:45 IST), so V4 holds only the column and index. Reads filter trashed entries in the service (the group holds the credentials), `getCredentialById` is now also scoped to the caller. `DELETE /api/pm/*` messages say "Moved to Trash."; the hub count of groups ignores groups with no live entry.
- [x] **Step 4: UI.** Delete dialogs say "Moves to Trash for 30 days". `VaultTrash.js` lists trashed entries with Restore / Delete forever, and an "Empty trash" confirm. Show the 409 message from the server. Done 2026-10-24: `ConfirmDialog` moved to `vaultShared.jsx` so the list and the Trash share it; "Empty trash" loops `purgeCredential`.
- [x] **Step 5: Run tests and lint; commit** `feat(vault): trash with 30-day restore`.

### Task 1.3: Password history

**Files:**
- Create: `.../pm/entity/CredentialHistoryEntity.java`, `.../pm/repository/CredentialHistoryRepository.java`
- Modify: `PasswordManagerServiceImpl.java` (`updateCredential`), `PasswordManagerController.java`
- Create: `db-world-frontend/src/features/password-manager/PasswordHistoryDialog.js`
- Modify: `ViewPassword.js`, `ApiServices.js`
- Test: `PasswordManagerServiceImplTest.java`

**Interfaces:**
- Produces: `CredentialHistoryEntity(id, credential, password @Convert encrypted LONGTEXT, changedAt Instant)`; service `List<PasswordHistoryDto> getHistory(String credentialId)` (newest first, max 5) and `void restorePassword(String credentialId, String historyId)`; endpoints `GET /api/pm/credential/{id}/history`, `POST /api/pm/credential/{id}/history/{hid}/restore`; `record PasswordHistoryDto(String id, String password, Instant changedAt)`.
- Consumes: Task 2.1 later replaces `password` in this DTO with a reveal call; until then it is returned (same exposure as the list today).

- [ ] **Step 1: Write failing tests.** `changingThePasswordKeepsTheOldOneInHistory`; `historyKeepsOnlyTheLastFive`; `savingWithTheSamePasswordAddsNothing`; `restoringAnOldPasswordPutsItBackAndRecordsTheCurrentOne`; `historyOfAnotherUsersCredentialIs404`.
- [ ] **Step 2: Run; expect FAIL.** **Step 3: Implement**, trimming the oldest rows after each insert. **Step 4: UI:** a History icon on the card opens `PasswordHistoryDialog` (masked values, show/copy, "Restore"). **Step 5: tests, lint, commit** `feat(vault): keep the last 5 passwords of an entry`.

### Task 1.4: Size limits

**Files:**
- Modify: `RequestPayloads.java` (`AddCredential`, `UpdateCredential`), `PasswordManagerServiceImpl.java`
- Test: `PasswordManagerServiceImplTest.java`

**Interfaces:**
- Produces: constants in `PasswordManagerServiceImpl`: `MAX_SECRET_CHARS = 4096` (password, PIN), `MAX_TEXT_CHARS = 65536` (notes, custom-field value), `MAX_CUSTOM_FIELDS = 30`; violations throw `DbWorldException(HttpStatus.BAD_REQUEST, "<field> is too long (max N)")`.

- [ ] **Step 1: Failing tests** `aNoteOver64KIsRejectedWithAClearMessage`, `thirtyOneCustomFieldsAreRejected`, `a3KBPrivateKeyInACustomFieldIsAccepted` (the case that started this work). **Step 2: run, expect FAIL. Step 3: implement `validateSizes(CredentialDto)` called from add and update. Step 4: pass. Step 5: commit** `fix(vault): cap secret and note sizes`.

---

## Phase 2: Secrets only when asked for

### Task 2.1: List without secrets, reveal one at a time

**Files:**
- Modify: `.../pm/dto/CredentialDto.java`, `PasswordManagerMapper.java`, `PasswordManagerController.java`, `PasswordManagerService.java` + `impl`
- Create: `.../pm/dto/CredentialSummaryDto.java`, `.../pm/dto/SecretField.java`
- Modify: `db-world-frontend/src/features/password-manager/ViewPassword.js`, `ApiServices.js`, `passwordUtils.js`, `offline/vaultCache.js`
- Create: `db-world-frontend/src/features/password-manager/useSecret.js`
- Test: new `PasswordManagerControllerTest.java`, `PasswordManagerServiceImplTest.java`, `passwordUtils.test.js`

**Interfaces:**
- Produces: `record CredentialSummaryDto(String id, String name, CredentialType type, String url, String username, boolean hasPassword, boolean hasPin, boolean hasNotes, int strength /*0-5*/, boolean reused, boolean breached /*false until 3.5*/, List<FieldSummary> customFields)` and `record FieldSummary(String id, String fieldKey, CustomFieldType fieldType, String fieldValue /* only for TEXT and URL, else null */)`; `GET /api/pm/` returns summaries; `GET /api/pm/credential/{id}/secret?field=password|pin|notes|custom:<fieldId>` returns `{ "value": "..." }`; service `String revealSecret(String credentialId, SecretField field)`; frontend `useSecret(credentialId, field)` returning `{ reveal(): Promise<string>, copy(): Promise<void> }` and `getSecret(credentialId, field)` in `ApiServices.js`.

- [ ] **Step 1: Write failing tests.** Controller: `listNeverContainsPasswordPinNotesOrHiddenValues` (serialise the response, assert none of the seeded secrets appear anywhere in the JSON); `revealReturnsTheSecretForTheOwner`; `revealOfAnotherUsersCredentialIs404` (Review Focus 3); `revealOfAnUnknownFieldIs400`. Service: `strengthAndReusedAreComputedOnTheServer` (two entries with the same password → both `reused=true`). Frontend: `scorePassword` parity test so the server and client scales match.
- [ ] **Step 2: Run; expect FAIL.**
- [ ] **Step 3: Implement.** Strength uses the same entropy bands as `passwordUtils.scorePassword` (port the thresholds; the frontend test pins parity). Each reveal logs `Credential secret read: credentialId, field, userId` at INFO (no value) and goes through a per-user rate limit of 60/minute using the project's existing rate-limit mechanism (find it with `semantic_search_nodes "rate limit"`; if none exists, a simple in-memory `Bucket` is enough and noted in the commit).
- [ ] **Step 4: UI.** `CredentialCard` shows masked placeholders from `hasPassword` etc.; Show and Copy call `useSecret`, which fetches, holds the value for 30 s in component state only, then drops it. The edit dialog fetches the secrets it needs when it opens. `analyzeVault` reads `strength` and `reused` from the summaries.
- [ ] **Step 5: Offline cache.** `cacheVault` currently snapshots the list, so it would now hold no secrets. Add `GET /api/pm/snapshot` (full old-style payload, same auth, same rate limit, INFO-logged) used only by `cacheVault` on the installed Android app. Test: `snapshotEndpointRequiresAuth`.
- [ ] **Step 6: Run all password-manager tests and lint; commit** `feat(vault): the list carries no secrets; reveal one at a time`.

### Task 2.2: Clipboard auto-clear

**Files:**
- Modify: `db-world-frontend/src/shared/services/CommonServices.js` (`handleCopy`)
- Test: `db-world-frontend/src/shared/services/CommonServices.test.js`

**Interfaces:**
- Produces: `handleCopy(text, { sensitive = false, clearAfterMs = 30000 })` — when `sensitive`, writes `''` to the clipboard after the delay if `navigator.clipboard.readText()` still equals `text` (when reading is not permitted, clear unconditionally).

- [ ] **Step 1: Failing tests** with fake timers: `clearsASensitiveCopyAfterThirtySeconds`, `leavesAnOrdinaryCopyAlone`, `doesNotClearIfTheClipboardChanged`. **Step 2: run, expect FAIL. Step 3: implement; pass `sensitive: true` from `useSecret.copy` and the generator. Step 4: pass, lint. Step 5: commit** `feat(vault): clear copied secrets from the clipboard after 30 s`.

---

## Phase 3: Organise, move in and out, hide the sites

### Task 3.1: Favourites, folders, tags, sorting

**Files:**
- Modify: `CredentialEntity.java` (`favorite boolean`, `folder String`, `tags` as `@ElementCollection Set<String>`), `CredentialDto`, `UpdateCredential`, `AddCredential`
- Modify: `ViewPassword.js` (filter chips, sort menu, star toggle), `AddPassword.js` and the edit dialog (folder + tags in "More options")
- Test: `PasswordManagerServiceImplTest.java`, `entryUtils.test.js`

**Interfaces:**
- Produces: DTO fields `boolean favorite`, `String folder` (≤ 64 chars, case-insensitive unique per user for the folder list), `Set<String> tags` (≤ 10, each ≤ 32); frontend `export const sortEntries = (vault, mode /* 'name'|'recent'|'strength' */) => vault` and `filterEntries(vault, { query, favoriteOnly, folder, tag })` in `entryUtils.js`.

- [ ] **Step 1: Failing tests:** `favoriteFolderAndTagsRoundTrip`, `moreThanTenTagsAreRejected`, `sortEntries sorts by name case-insensitively`, `filterEntries combines folder and tag`. **Step 2: run, expect FAIL. Step 3: implement. Step 4: pass. Step 5: commit** `feat(vault): favourites, folders, tags and sorting`.

### Task 3.2: Export (encrypted) and CSV export

**Files:**
- Create: `.../pm/service/VaultExportService.java`, controller methods `GET /api/pm/export?format=json|csv`
- Create: `db-world-frontend/src/features/password-manager/ExportVault.js`
- Test: `VaultExportServiceTest.java`

**Interfaces:**
- Produces: `byte[] export(Long userId, ExportFormat format)`; `enum ExportFormat { JSON, CSV }`; the JSON export is always returned as an age-style passphrase-encrypted file: the request carries a `passphrase` and the response is AES-256-GCM with a PBKDF2-HMAC-SHA256 key (≥ 310,000 iterations); CSV requires an explicit `confirm=true` and re-authentication, and logs at WARN.

- [ ] **Step 1: Failing tests:** `exportedJsonIsNotReadableWithoutThePassphrase`, `exportedJsonRoundTripsWithThePassphrase`, `csvExportNeedsConfirm`, `exportOnlyContainsTheCallersEntries`. **Step 2: run, expect FAIL. Step 3: implement using `javax.crypto` only (no new dependency). Step 4: UI with a passphrase field and a plain-text-CSV warning. Step 5: commit** `feat(vault): encrypted export, and CSV export behind a confirmation`.

### Task 3.3: Import

**Files:**
- Create: `.../pm/service/VaultImportService.java`, `.../pm/importer/CsvVaultParser.java`, controller `POST /api/pm/import`
- Create: `db-world-frontend/src/features/password-manager/ImportVault.js`
- Test: `CsvVaultParserTest.java`, `VaultImportServiceTest.java`

**Interfaces:**
- Produces: `record ImportRow(String name, String url, String username, String password, String notes)`; `List<ImportRow> parse(InputStream csv, ImportSource source)` for `enum ImportSource { CHROME, BITWARDEN, ONEPASSWORD, GENERIC }`; `record ImportResult(int imported, int skippedDuplicates, List<RowError> errors)` where `RowError(int line, String reason)`.
- Consumes: `addCredential(host, dto)` from the existing service, and the duplicate rule.

- [ ] **Step 1: Failing tests (Review Focus 4):** `quotedFieldsWithNewlinesAndCommasParse`, `aUtf8BomIsIgnored`, `aRowWithNoPasswordIsStillImported`, `aRowWithNoUsernameOrNameIsReportedNotFatal`, `fiftyThousandRowsAreRefusedWith413`, `duplicatesAreSkippedAndCounted`, `chromeAndBitwardenHeadersAreRecognised`. **Step 2: run, expect FAIL. Step 3: implement a small RFC 4180 parser (no new dependency) and run the import in one transaction per 500 rows. Step 4: UI shows imported/skipped/errors with line numbers. Step 5: commit** `feat(vault): import from Chrome, Bitwarden, 1Password and generic CSV`.

### Task 3.4: Encrypt the site URL

**Files:**
- Modify: `CredentialEntity.java` (`url` gets `StringCryptoConverter`, length 4096), `PasswordManagerServiceImpl.java`, `HostEntity`/`PasswordManagerEntity` usage
- Create: `.../pm/service/impl/HostBlindIndex.java`, `db-world-backend/src/main/resources/db/migration/V<next>__vault_encrypt_urls.sql`
- Test: `HostBlindIndexTest.java`, `PasswordManagerServiceImplTest.java`

**Interfaces:**
- Produces: `String HostBlindIndex.of(Long userId, String host)` — HMAC-SHA256 of `userId + ":" + host` with a key from config `app.vault.host-index-key`, hex, so grouping and duplicate lookups still work without storing the host in clear; `PasswordManagerEntity.hostIndex` replaces the `HOST` foreign key for lookups (the `HOST` table stops being written).

- [ ] **Step 1: Failing tests:** `sameHostSameUserGivesTheSameIndex`, `sameHostDifferentUserGivesADifferentIndex`, `urlIsStoredEncrypted`, `groupingStillFindsEntriesByHost`. **Step 2: run, expect FAIL.** **Step 3: implement, plus a one-off `CryptoMigrationService`-style method that re-saves every credential so `url` is encrypted and `hostIndex` is filled (idempotent; run from the admin console like the existing migration).** **Step 4: Flyway file adds the `host_index` column and its index (guarded). The re-save of every credential is the admin-console migration from Step 3, run once after deploy; dropping the old `host` FK is a later V<n>, after the data has been verified.** **Step 5: commit** `feat(vault): site URLs are encrypted at rest`.

### Task 3.5: Breach check

**Files:**
- Create: `.../pm/service/impl/BreachCheckService.java`, `.../pm/service/impl/BreachCheckJob.java`
- Modify: `CredentialEntity.java` (`breachedAt Instant`), `CredentialSummaryDto.breached`
- Test: `BreachCheckServiceTest.java`

**Interfaces:**
- Produces: `boolean BreachCheckService.isBreached(String password)`: SHA-1 the password, send only the first 5 hex characters to `https://api.pwnedpasswords.com/range/{prefix}` with header `Add-Padding: true`, match the suffix locally; a weekly job sets `breachedAt` and the summaries expose `breached`.

- [ ] **Step 1: Failing tests** against a stubbed `WebClient`: `onlyTheFirstFiveHashCharactersLeaveTheServer`, `aPaddedZeroCountRowIsNotAMatch`, `aNetworkFailureLeavesTheFlagUnchanged`. **Step 2: run, expect FAIL. Step 3: implement. Step 4: show a red "Breached" tag on cards and a filter chip. Step 5: commit** `feat(vault): flag passwords found in known breaches`.

---

## Phase 4: Android autofill and save-from-site

> Detailed steps for 4.x are written when the phase starts, after a one-day on-device spike (Task 4.0), because the exact `AutofillService` and `androidx.biometric` behaviour on the target phone decides several signatures. The interfaces below are the decisions.

### Task 4.0: Spike

- [ ] On a real phone: a hello-world `AutofillService` registered in the manifest, selected in system settings, filling a username in Chrome and in one native app. Record what `AssistStructure` gives for `webDomain` in Chrome and in the Capacitor WebView. Write the result into this section.

### Task 4.1: Native store for autofill

**Files:**
- Create: `db-world-frontend/android/app/src/main/java/com/db/dbworld/autofill/AutofillVaultStore.kt`, `AutofillVaultPlugin.java`
- Create: `db-world-frontend/src/platform/android/autofillVault.js`
- Modify: `MainActivity.java` (register plugin), `ViewPassword.js` (push after each successful load)
- Test: `AutofillVaultStoreTest.kt` (JVM, with a fake key provider), `autofillVault.test.js`

**Interfaces:**
- Produces: `AutofillVaultStore.save(entries: List<AutofillEntry>)`, `AutofillVaultStore.find(host: String?, packageName: String?): List<AutofillEntry>`; `data class AutofillEntry(val id: String, val name: String, val host: String?, val androidPackage: String?, val username: String, val password: String)`; JS `autofillVaultSync(entries)` and `autofillVaultClear()`; storage is one file encrypted with an AndroidKeyStore AES-GCM key that requires user authentication within 30 s (same policy as `VaultCryptoPlugin`); `autofillVaultClear()` is called on sign-out.

### Task 4.2: The autofill service

**Files:**
- Create: `.../autofill/DbWorldAutofillService.kt`, `AuthActivity.kt`, `DomainMatcher.kt`
- Modify: `AndroidManifest.xml`, `res/xml/autofill_service.xml`
- Test: `DomainMatcherTest.kt`

**Interfaces:**
- Produces: `object DomainMatcher { fun matches(entryHost: String, requestHost: String): Boolean }` — true only when the registrable domains are equal (public-suffix aware; use OkHttp's `PublicSuffixDatabase` if OkHttp is on the classpath, else a bundled list) and `requestHost` is `entryHost` or a subdomain of it. Unit tests (Review Focus 5): `paypal.com` matches `www.paypal.com` and `login.paypal.com`; does not match `paypal.com.evil.io`, `evilpaypal.com`, `paypal.co`; `bbc.co.uk` does not match `evil.co.uk`.
- The service answers `onFillRequest` with a `FillResponse` that requires authentication; `AuthActivity` shows `BiometricPrompt`, then returns the matching datasets. Guarded with `@RequiresApi(26)` and a manifest entry that is inert on API 23-25. Never fills a field in a window whose package is not the one the browser reports.

### Task 4.3: Save from a site or app

**Files:**
- Modify: `DbWorldAutofillService.kt` (`onSaveRequest`), `MainActivity.java` (deep link `dbworld://vault/add`)
- Modify: `db-world-frontend/src/features/password-manager/AddPassword.js`, `app/App.jsx`
- Test: `AddPassword` prefill covered by `entryUtils.test.js` (`prefillFromIntent`), manual device test script in this section

**Interfaces:**
- Produces: `export const prefillFromIntent = (query) => ({ name, url, username })` (URL-decoded, host only, `androidapp://<package>` for native apps); the password never travels in the URL — `onSaveRequest` passes it in a one-shot in-memory handoff (`PendingSave.take()`), and the add form reads it on mount and clears it.

---

## Phase 5: Passkeys

> Same rule as Phase 4: a spike first. Passkey provider support needs Android 14 (API 34) and `androidx.credentials` provider classes whose exact versions are checked in the spike.

### Task 5.1: Spike

- [ ] On an Android 14+ phone: register a minimal `CredentialProviderService`, select it under Settings > Passwords, create a passkey at `webauthn.io` and sign in with it. Record the library versions and what `BeginCreateCredentialRequest` / `BeginGetCredentialRequest` carry. Decide, with the user, whether synced passkeys are wanted (Decisions say device-local first).

### Task 5.2: Passkey entry type and device-local store

**Files:**
- Modify: `CredentialType.java` (add `PASSKEY`), `PasswordManagerServiceImpl.java` (entries of this type carry metadata only: relying-party id, user name, created-at, "stored on this device")
- Create: `.../passkey/PasskeyStore.kt`, `PasskeyProviderService.kt`, `PasskeyPlugin.java`
- Create: `db-world-frontend/src/platform/android/passkeys.js`
- Modify: `ViewPassword.js` (show "Passkey on this device", no secret to reveal)
- Test: `PasskeyStoreTest.kt`, service test `aPasskeyEntryNeverStoresPrivateKeyMaterialOnTheServer`

**Interfaces:**
- Produces: `PasskeyStore.create(rpId: String, userHandle: ByteArray, userName: String): PasskeyRecord` (EC P-256 key generated inside AndroidKeyStore, `setUserAuthenticationRequired(true)`, so the private key never leaves the chip); `PasskeyStore.sign(credentialId: ByteArray, clientDataHash: ByteArray): ByteArray`; `data class PasskeyRecord(val credentialId: ByteArray, val rpId: String, val userName: String, val createdAt: Long)`. Passing the server only `PasskeyRecord` fields keeps the "device-local first" decision.

---

## Execution: switching the model per task

What is and is not possible, so the plan does not promise more than the tools do:

- **This session cannot change its own model.** Use the model menu. A session that is more expensive than a task needs is fine; one that is cheaper than the task needs is the problem.
- **`start_session` takes a `model`**, but only the same family as the starting session or a cheaper one; anything more expensive is ignored. So run the *orchestrating* session on **Opus 5.5** and let it start Sonnet and Haiku sessions for the cheaper phases.
- **`set_session_model`** can switch a session this one started to a cheaper model without asking; a more expensive one asks you first.
- **Task 0.1 turns this into one command.** From an Opus session, `/vault-phase 1` starts a Sonnet session for Phase 1, `/vault-phase 2` runs Phase 2 in a session on Opus, and so on. From a Sonnet session, `/vault-phase 2` refuses and tells you to switch.

Order: 0 → 1 → 2 → 3 → 4 → 5. Task 0.2 (offline) comes before Phase 2. Phases 1 and 3 can run in parallel with 4.0 (the spike touches only Android files). Phase 2 must finish before 3.5 and before 4.1 (the autofill store needs the snapshot endpoint).

## Self-review

- **Coverage:** every item from the conversation maps to a task: field types 1.1, trash 1.2, history 1.3, limits 1.4, reveal-on-demand 2.1, clipboard 2.2, organisation 3.1, export 3.2, import 3.3, URL encryption 3.4, breach check 3.5, autofill 4.1-4.3, passkeys 5.x, model switching 0.1. TOTP and zero-knowledge are excluded in Decisions.
- **Depth is uneven on purpose.** Phases 1-3 are written to implementation depth. Phases 4-5 stop at interfaces and decisions, with a spike first, because on-device behaviour decides signatures I cannot know from the desk. Each gets its detailed task list when it starts.
- **Open decision for the user:** passkey sync across devices (deferred). CSV export, Flyway and the execution style were settled on 2026-10-24 (see Decisions). Flyway is done: it was built and verified before Phase 0.
