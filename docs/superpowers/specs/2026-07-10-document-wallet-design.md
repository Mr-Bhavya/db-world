# Document Wallet

- **Date:** 2026-07-10
- **Branch:** `feat/document-wallet` (off `development`)
- **Status:** Design — pending user review
- **Author:** Claude (Opus 4.8) with bhavya.dudhia

---

## 1. Problem & Context

db-world users have no place to keep their personal government documents (Aadhaar, PAN,
driving licence, passport, voter ID, …). This feature adds a **Document Wallet**: a per-user,
encrypted store where a logged-in user can **add, list, preview, download, edit, delete, and
share** their own documents, and where an **admin** manages the catalog of document *types* and
monitors aggregate usage.

These are among the most sensitive documents a person owns, so **security and privacy drive the
design**: file bytes are encrypted at rest, a user can only ever touch their own documents, and
admins see aggregate numbers only — never another user's actual files or ID numbers.

### What the codebase already gives us (reused, not reinvented)

| Need | Existing building block |
|---|---|
| Per-user encrypted store structure | `app.pm` (password manager) module layout |
| Column-level field encryption | `security/crypto/StringCryptoConverter` (AES-256 via Jasypt) |
| Multipart upload + streaming download | `app.filemanager` (`FileManagerController`/`Service`, `jailed()` path guard) |
| Current-user identity | `core/context/UserContext.userId()` |
| Endpoint role gating | `@AnyRole` / `@AdminAccess` meta-annotations; `AppConstants.PUBLIC_APIS` |
| Response envelope | `api/response/ApiResponse`, `PageResponse` |
| File storage root | `AppProperties.getDataPath()` |
| Admin-editable runtime settings | `app_config` + `SettingsService` + `ConfigKeys` + `/api/admin/config` + `/admin/settings` page (merged into `development`) |
| Frontend upload/download/preview UI | `admin/filemanager` (`UploadDialog.jsx`, ticket/anchor download) |
| Frontend feature conventions | `admin/*` (TanStack Query, RHF+Zod, MUI, `useT()`, Notistack) |

The **one net-new capability** is at-rest encryption of file *contents* — the file-manager
stores plaintext bytes today, so we add a small AES-GCM streaming helper.

---

## 2. Goals & Non-Goals

### Goals
- Per-user private wallet: a user can only see/preview/download/share/delete **their own**
  documents (scoped by `UserContext.userId()`); ownership mismatch returns 404.
- File contents encrypted at rest with AES-GCM; decrypted only when streamed to the owner (or a
  valid share-link holder).
- Minimal add flow: **only Type + File are required**; all other metadata is optional.
- Admin-managed, DB-backed **document types** (dropdown catalog) with admin CRUD, seeded with
  sensible defaults.
- Admin **monitor** view of aggregate metadata only (counts, storage, per-type breakdown, active
  shares) — no access to users' files or ID numbers.
- Admin-editable **max file size** (default 10 MB) and **allowed content types** (PDF/JPEG/PNG),
  reusing the existing `app_config` settings surface.
- Time-limited, revocable **share links** with access logging.
- Web-first, then wired into the Capacitor/Android app.

### Non-Goals
- Expiry reminders / notifications (an optional expiry *date* column is kept, but no scheduler or
  notification logic is built).
- Admins viewing/downloading other users' documents (explicitly out — privacy boundary).
- OCR / auto-extraction of ID numbers from scans.
- Internal user-to-user sharing (share is via public time-limited link only).
- Versioning / document history.
- A generic settings-schema builder (max-size/allowed-types are declared in the config registry
  in code, per the existing app-config design).

---

## 3. Decisions (confirmed with user)

1. **Ownership:** per-user private wallet, keyed by `userId`.
2. **At-rest encryption:** encrypt file bytes — AES-GCM, app master key, per-file random IV.
3. **v1 features:** add / list / preview / download / edit metadata / delete / share.
4. **Document types:** DB-backed and admin-managed (not a hardcoded enum), seeded with defaults.
5. **Add form:** minimal — Type + File required, rest optional/collapsed.
6. **File rules:** PDF, JPEG, PNG only; max size default **10 MB**, admin-editable.
7. **Admin monitor:** aggregate metadata only; no access to users' documents/numbers.
8. **Sharing:** time-limited, revocable public link; token stored hashed; access logged.
9. **Platform:** web first, then Android (built locally, not in this environment).

---

## 4. Architecture

### 4.1 Backend module — `com.db.dbworld.app.wallet` (mirrors `app.pm`)

```
app/wallet/
├─ controller/
│   ├─ WalletDocumentController        @RequestMapping("/api/wallet")            @AnyRole
│   ├─ WalletShareController           (share create/list/revoke; owner-scoped)  @AnyRole
│   ├─ WalletSharePublicController     @RequestMapping("/api/wallet/shared")     (public)
│   └─ WalletAdminController           @RequestMapping("/api/admin/wallet")      @AdminAccess
├─ service/
│   ├─ WalletDocumentService     (+ impl/WalletDocumentServiceImpl)
│   ├─ WalletShareService        (+ impl/WalletShareServiceImpl)
│   ├─ WalletTypeService         (+ impl/WalletTypeServiceImpl)      // type catalog + seeding
│   └─ WalletStorageService      (+ impl/WalletStorageServiceImpl)   // jailed path + encrypt I/O
├─ repository/  WalletDocumentRepository, WalletShareRepository, WalletDocumentTypeRepository
├─ entity/      WalletDocumentEntity, WalletShareEntity, WalletDocumentTypeEntity
├─ dto/         WalletDocumentDto, WalletDocumentSummaryDto,
│               CreateDocumentRequest, UpdateDocumentRequest,
│               WalletDocumentTypeDto, UpsertDocumentTypeRequest,
│               ShareDto, CreateShareRequest, SharedDocumentInfoDto,
│               WalletStatsDto
├─ mapper/      WalletDocumentMapper, WalletDocumentTypeMapper (MapStruct, BaseMapperConfig)
└─ crypto/      WalletFileCryptor      // AES-GCM stream encrypt/decrypt
```

Conventions matched: constructor injection via `@RequiredArgsConstructor`, `@Log4j2`,
interface+`impl` service split, `*Entity`/`*Dto`/`*Repository` suffixes, responses wrapped in
`com.db.dbworld.api.response.ApiResponse`, errors thrown as `DbWorldException` and shaped by
`GlobalExceptionHandler`.

### 4.2 Frontend — `src/features/wallet/` (user) + `src/features/admin/wallet/` (admin)

```
features/wallet/
├─ index.jsx                       // user wallet page (default export, lazy-loaded)
├─ SharedDocumentPage.jsx          // public share landing (no auth)
├─ api/walletApi.js                // axios wrappers → unwrap res.data.data
├─ hooks/useWallet.js              // useQuery(['wallet',...]) + add/edit/delete/share mutations
├─ schemas/documentSchemas.js      // zod
└─ components/
    ├─ DocumentCard.jsx
    ├─ AddDocumentDialog.jsx       // minimal form; RHF+Zod+useT+Notistack; drag-drop upload
    ├─ EditDocumentDialog.jsx
    ├─ DocumentPreviewDialog.jsx   // authenticated blob → <img>/<iframe>
    ├─ ShareDialog.jsx             // create/copy/list/revoke links + govt-ID warning
    └─ WalletTypeSelect.jsx        // dropdown fed by active types

features/admin/wallet/
├─ index.jsx                       // tabbed: Document Types | Monitor
├─ adminWalletApi.js
├─ DocumentTypesTab.jsx            // MUI DataGrid + Upsert dialog
├─ MonitorTab.jsx                  // stat cards + per-type chart (@mui/x-charts) + settings
└─ typeSchemas.js
```

---

## 5. Data Model

Three new tables (schema `db_world`), created by Hibernate `ddl-auto=update`. IDs are
`GenerationType.UUID` `String` (36). Timestamps are `Instant` via `@CreationTimestamp` /
`@UpdateTimestamp`.

### 5.1 `wallet_document_type` (admin-managed catalog)

| column | type | notes |
|---|---|---|
| `id` | VARCHAR(36) PK | UUID |
| `code` | VARCHAR(40) UNIQUE NOT NULL | e.g. `AADHAAR`, `PAN`, `DRIVING_LICENCE` |
| `display_name` | VARCHAR(100) NOT NULL | "Aadhaar Card" |
| `description` | VARCHAR(300) | optional help text |
| `icon_key` | VARCHAR(40) | optional UI icon hint |
| `requires_number` | BOOLEAN NOT NULL default false | whether the number field shows/required |
| `number_label` | VARCHAR(60) | label for the number field ("Aadhaar Number") |
| `active` | BOOLEAN NOT NULL default true | inactive = hidden from user dropdown |
| `sort_order` | INT NOT NULL default 0 | dropdown ordering |
| `created_at` / `updated_at` | timestamp | |

Seeded idempotently in `@PostConstruct` (pattern from `SchedulerAdminService.seedDefaults` —
never overwrites existing rows): Aadhaar Card, PAN Card, Driving Licence, Passport, Voter ID,
Other.

### 5.2 `wallet_document`

Index on `user_id`; composite index `(user_id, document_type_id)`.

| column | type | notes |
|---|---|---|
| `id` | VARCHAR(36) PK | UUID |
| `user_id` | BIGINT NOT NULL | owner (from `UserContext.userId()`) |
| `document_type_id` | VARCHAR(36) NOT NULL | FK → `wallet_document_type.id` |
| `label` | VARCHAR(150) NOT NULL | defaults to type display name if user leaves blank |
| `document_number` | LONGTEXT NULL | **encrypted** via `@Convert(StringCryptoConverter.class)` |
| `issue_date` | DATE NULL | optional |
| `expiry_date` | DATE NULL | optional (no reminder logic) |
| `notes` | LONGTEXT NULL | **encrypted** `@Lob` |
| `original_file_name` | VARCHAR(255) NOT NULL | as uploaded |
| `content_type` | VARCHAR(100) NOT NULL | `application/pdf` \| `image/jpeg` \| `image/png` |
| `file_size` | BIGINT NOT NULL | **plaintext** byte size (for display/Content-Length) |
| `stored_path` | VARCHAR(300) NOT NULL | relative path of encrypted blob |
| `created_at` / `updated_at` | timestamp | |

Encrypted blob lives at `AppProperties.getDataPath()/wallet/{userId}/{documentId}.enc`, written
through a `jailed()`-style guard (resolve+normalize against the wallet base dir; reject
traversal) reused from the file-manager.

### 5.3 `wallet_share`

Unique index on `token_hash`; index on `document_id`.

| column | type | notes |
|---|---|---|
| `id` | VARCHAR(36) PK | UUID |
| `document_id` | VARCHAR(36) NOT NULL | FK → `wallet_document.id` |
| `created_by_user_id` | BIGINT NOT NULL | must equal document owner |
| `token_hash` | VARCHAR(64) UNIQUE NOT NULL | SHA-256 hex of the raw token (raw token never stored) |
| `expires_at` | timestamp NOT NULL | |
| `max_access_count` | INT NULL | null = unlimited within expiry |
| `access_count` | INT NOT NULL default 0 | |
| `revoked` | BOOLEAN NOT NULL default false | |
| `created_at` | timestamp | |

---

## 6. Encryption Design — `WalletFileCryptor`

- **Algorithm:** `AES/GCM/NoPadding`, 256-bit key, 96-bit (12-byte) random IV per file, 128-bit
  auth tag. GCM gives confidentiality **and** tamper detection.
- **On-disk format:** `[12-byte IV][ciphertext‖16-byte GCM tag]`. IV is generated per file with
  `SecureRandom` and prepended.
- **Streaming:** encrypt on upload via `CipherOutputStream` wrapping the target file stream after
  writing the IV; decrypt on download via reading the IV then `CipherInputStream`. Documents are
  small (≤ max size), so memory pressure is negligible; streaming avoids full-buffer loads.
- **Key management:**
  - Primary: `WALLET_ENCRYPTION_KEY` env var (base64-encoded 32 bytes), imported via
    `../runtime/backend.env` alongside other secrets.
  - Fallback (dev convenience): if unset, derive a key with PBKDF2 from `JASYPT_PASSWORD` + a
    fixed app salt, and log a WARN recommending an explicit key in prod.
  - Bound as a typed `WalletCryptoProperties`/`@Value`, resolved once at startup.
  - **Key separation (do NOT share one master key across subsystems):** the wallet file key is
    dedicated and distinct from (a) the Jasypt passphrase used by the password manager and
    column encryption, and (b) the CDN signing secret, which is an HMAC URL-signing key shared
    with nginx. They differ in purpose (encryption vs URL signing), algorithm (AES-GCM vs HMAC),
    exposure surface (app-only vs edge/nginx), and rotation cadence. Sharing one key would let a
    leak of the least-sensitive secret (CDN) compromise the most-sensitive data (government IDs)
    and make independent rotation impossible. The only cross-key touchpoint is the dev-only
    PBKDF2 fallback above.
  - **Documented hard rule:** losing the key makes all stored files unrecoverable — it must be
    backed up (called out in Rollout §11 and README/runtime docs).

`document_number` and `notes` columns are separately encrypted by the existing
`StringCryptoConverter` (Jasypt), so metadata secrecy does not depend on the file key.

---

## 7. Configuration (reuses existing `app_config` / `SettingsService`)

Two keys added to the config **registry** (code-side `SettingDefinition` list) under a new
`Document Wallet` category — declared in code, edited by value, per the app-config design:

| key (`ConfigKeys`) | type | default | bounds | meaning |
|---|---|---|---|---|
| `wallet.max-file-size-bytes` | LONG | `10485760` (10 MB) | min 1 MB | reject uploads larger than this |
| `wallet.allowed-content-types` | STRING | `application/pdf,image/jpeg,image/png` | — | CSV allow-list |

Consumers read live values at point-of-use via `SettingsService.getLong(...)` /
`getString(...)` (cache-backed, never throws — falls back to registry default). Because they're
`app_config` keys, they appear automatically on the existing **`/admin/settings`** page **and**
are surfaced/editable on the wallet admin Monitor tab (which calls the same
`/api/admin/config/{key}` PUT). No new settings backend is built.

Spring multipart limits stay uncapped (as today); the app-level check in `WalletDocumentService`
is the enforced cap, returning a 400 with a clear message when exceeded.

---

## 8. API Surface

All user endpoints are `@AnyRole` and owner-scoped via `UserContext.userId()`. Responses use
`ApiResponse<T>`. Ownership mismatch → **404** (do not leak existence).

### 8.1 User — documents (`/api/wallet`)
- `GET /documents?typeId=&q=` → `List<WalletDocumentSummaryDto>` (number **masked**, e.g.
  `•••• •••• 1234`; filter by type and label substring).
- `GET /documents/{id}` → `WalletDocumentDto` (full number — owner viewing their own, for edit).
- `POST /documents` (multipart: `file` + form fields `typeId`, `label?`, `number?`, `issueDate?`,
  `expiryDate?`, `notes?`) → validate type active, content-type in allow-list (+ magic-byte
  sniff), size ≤ cap; encrypt & store; persist row → `WalletDocumentDto`.
- `PUT /documents/{id}` → update metadata only (not the file) → `WalletDocumentDto`.
- `DELETE /documents/{id}` → delete encrypted blob + row + all its shares.
- `GET /documents/{id}/content?disposition=inline|attachment` → stream **decrypted** bytes;
  `inline` for preview, `attachment` for **download** (sets `Content-Disposition` + `Content-Type`
  + `Content-Length`=`file_size`).

### 8.2 User — shares (`/api/wallet`)
- `POST /documents/{id}/shares` `{ expiresInHours, maxAccessCount? }` → generate 256-bit token,
  store its SHA-256; return `ShareDto` including the **full share URL with the raw token, shown
  once**.
- `GET /documents/{id}/shares` → active (non-revoked, non-expired) shares for that doc.
- `DELETE /shares/{shareId}` → revoke (owner only).

### 8.3 Public — shared document (`/api/wallet/shared`, added to `PUBLIC_APIS`)
- `GET /{token}/info` → `SharedDocumentInfoDto` (type display name, label, original file name,
  content type, size) — **no number, no notes**. Resolves token by hash; enforces
  not-revoked / not-expired / under access cap.
- `GET /{token}/content?disposition=inline|attachment` → same checks, increments `access_count`,
  logs the access, streams the decrypted file.

### 8.4 Admin — types + monitor (`/api/admin/wallet`, `@AdminAccess`)
- `GET /types` → all types (incl. inactive) for management grid.
- `POST /types` / `PUT /types/{id}` → create/update (`UpsertDocumentTypeRequest`); unique `code`.
- `DELETE /types/{id}` → if referenced by any document, **deactivate** instead of hard-delete
  (returns a message); otherwise hard-delete.
- `GET /stats` → `WalletStatsDto`: total documents, total storage bytes, count per type, active
  share count. **Aggregate only — no per-user document access.**

### 8.5 User — types (dropdown)
- `GET /api/wallet/document-types` (`@AnyRole`) → **active** types only, ordered by `sort_order`.

---

## 9. Sharing Design & Lifecycle

1. Owner opens **Share** on a document, picks an expiry (1h / 24h / 7d) and optional max-view
   count. `24h` is the default.
2. Server generates a 256-bit `SecureRandom` token (base64url), stores only `SHA-256(token)`,
   `expires_at`, `max_access_count`. Raw token is returned once and never persisted.
3. Share URL: `{frontendBase}/db-world/shared-doc/{token}` (frontend base from the existing
   `apiBaseUrl`/`publicShareUrl` helper). Recipient needs no account.
4. Public endpoints hash the incoming token, look up the row, and enforce
   **revoked? / expired? / access_count < max_access_count?** before streaming. Each successful
   content fetch increments `access_count` and writes a log line.
5. Owner can list active shares and **revoke** any at any time; delete of a document cascades to
   its shares.

**Security posture:** anyone holding a live link can view the document until it expires or is
revoked — this is inherent to link sharing. Mitigations: short default expiry, revocation,
optional view cap, tokens stored hashed (DB leak ≠ usable links), every access logged, and a
prominent warning banner in the Share dialog that a real government ID is being exposed.

---

## 10. Frontend UX

### 10.1 User wallet page (`/db-world/db-wallet`, `routeConfig.protected`, VIEWER+)
- Header with search box + type-filter chips; responsive grid of `DocumentCard` (type icon,
  label, masked number, file-type badge, date); "Add document" button.
- App-launcher tile added to `homeData.jsx` `APPS` (teal accent), route constant
  `DB_WALLET_ROUTE` in `shared/constants/index.js`, lazy route in `App.jsx`.
- Data via `useWallet.js`: `useQuery(['wallet','documents',{typeId,q}])`, mutations for
  add/edit/delete/share that `invalidateQueries(['wallet'])` and toast via Notistack.

### 10.2 Add / Edit dialogs
- **Add** (minimal): `WalletTypeSelect` (required) + drag-drop file zone (required, PDF/JPG/PNG,
  client-side size/type check mirroring server caps, per-file `LinearProgress` from
  `UploadDialog.jsx`). A collapsed **"Add details (optional)"** section reveals Label, Number
  (shown/labelled per the selected type's `requires_number`/`number_label`), Issue/Expiry date,
  Notes. RHF + Zod + `useT()`.
- **Edit**: same detail fields (file not replaceable in v1), prefilled from `GET /documents/{id}`.

### 10.3 Preview & download
- **Preview** (`DocumentPreviewDialog`): fetch `/content?disposition=inline` as an authenticated
  blob (axios sends the Bearer header), create an object URL, render `<img>` for images /
  `<iframe>` for PDF; revoke the URL on close.
- **Download**: fetch `/content?disposition=attachment` as a blob → anchor-click save (web); on
  Android, write via `@capacitor/filesystem` (§11).

### 10.4 Share dialog
- Expiry + optional view-cap selectors, "Create link" → shows the one-time URL with copy button;
  lists existing active shares with revoke; govt-ID warning banner.

### 10.5 Public share page (`/db-world/shared-doc/:token`, `routeConfig.public`)
- Fetches `/shared/{token}/info`, shows type/label/filename, inline preview, and a download
  button; friendly error states for expired/revoked/not-found.

### 10.6 Admin wallet page (`/admin/wallet`, `@AdminAccess`, nav item in `AdminLayout`)
- **Document Types tab**: MUI DataGrid (code, name, requires-number, active, order) + Upsert
  dialog (RHF+Zod) + activate/deactivate + reorder.
- **Monitor tab**: stat cards (total documents, total storage, active shares) + per-type
  breakdown chart (`@mui/x-charts`); plus the max-size / allowed-types settings (edited via the
  existing `/api/admin/config` endpoints). Aggregate metadata only.

All admin UI follows the AdminV2 consistency rule (TanStack Query, RHF+Zod, MUI DataGrid,
Notistack, Framer Motion).

---

## 11. Android (phase after web)

The Capacitor webview runs the same React feature unchanged. Native touch-ups only:
- **Download:** detect native (Capacitor) and write the fetched blob via `@capacitor/filesystem`
  to a user-visible folder; optionally offer the share sheet via `@capacitor/share`.
- **PDF preview:** Android WebView may not render a PDF blob in an `<iframe>`; fall back to a
  bundled pdf.js render or open externally. Images preview normally.
- **Build:** the Android app is built **locally on the user's machine, not in this environment**
  (per project notes, the Gradle build can't run in the Claude Code shell).

---

## 12. Security & Privacy Summary

- **Isolation:** every user endpoint filters by `userId`; cross-user access returns 404.
- **At rest:** file bytes AES-GCM encrypted; `document_number` and `notes` column-encrypted.
- **Admin boundary:** admins manage types and see aggregate stats only; there is **no** admin
  endpoint that returns another user's file bytes or decrypted number.
- **Sharing:** hashed tokens, expiry, revocation, view cap, access logging, explicit warning.
- **Transport:** existing JWT + HTTPS; public share endpoints require a valid unguessable token.
- **Uploads:** content-type allow-list + magic-byte sniff + size cap guard against disguised or
  oversized files; `jailed()` path guard prevents traversal.
- **Key custody:** `WALLET_ENCRYPTION_KEY` in `runtime/backend.env`; loss = unrecoverable files.

---

## 13. Testing

**Backend (unit):**
- `WalletFileCryptor`: encrypt→decrypt round-trip equals original; tampered ciphertext/IV → GCM
  auth failure; distinct IV per call.
- Path jail rejects `..`/absolute traversal; per-user subfolder isolation.
- Upload validation: rejects disallowed content type, magic-byte mismatch, over-cap size.
- Share: token hashing; expired / revoked / over-cap access denied; `access_count` increments.
- Type service: seeding idempotent; in-use type deactivates instead of deletes; duplicate code
  rejected.

**Backend (integration):**
- Ownership isolation: user A cannot GET/preview/download/delete user B's document (404).
- Full flow: upload → list (masked) → detail (full number) → preview → download → edit → delete.
- Share flow: create → public info/content redeem → revoke → subsequent redeem denied.
- Admin: types CRUD; `GET /stats` returns correct aggregates and never file bytes.
- Boot with empty tables: types seed; wallet config keys fall back to registry defaults.

**Frontend:**
- Light: Add-dialog Zod validation (required Type+File, size/type rejection); manual end-to-end
  verification via the browser preview tools (add → preview → download → share → revoke).

---

## 14. Rollout & Ops

- Ship backend module + frontend user feature + admin page together on `feat/document-wallet`.
- `ddl-auto=update` creates the three tables on boot; type defaults seed automatically. No
  migration tool needed. (Add a hand-written idempotent `.sql` in `db/migration/` only if a
  special index Hibernate won't create is required.)
- Add `wallet.*` keys to the config registry so they seed into `app_config` and appear on the
  Settings + admin wallet pages.
- **Set `WALLET_ENCRYPTION_KEY` in `runtime/backend.env` before go-live and back it up** — losing
  it makes stored documents unrecoverable. Document this in the runtime env notes.
- Add `/api/wallet/shared/**` to `AppConstants.PUBLIC_APIS`; all other wallet paths stay
  authenticated.
- Backend build: JDK 25 + Maven wrapper (per project build notes).
- Android build performed locally by the user after web lands.

---

## 15. Resolved Decisions

1. Per-user private wallet; admins get aggregate-only monitoring.
2. AES-GCM file encryption, app master key (`WALLET_ENCRYPTION_KEY`) with dev PBKDF2 fallback.
3. DB-backed, admin-managed document types (seeded), user picks from active types via dropdown.
4. Minimal add form (Type + File required); other metadata optional/collapsed.
5. PDF/JPEG/PNG only; 10 MB default cap, admin-editable via the existing `app_config` surface.
6. Public, time-limited, revocable share links (default 24h), tokens hashed, access logged.
7. Web first, then Android (built locally).

## 16. Open Items (to confirm during planning, not blocking)

- Exact `SettingDefinition` / `ConfigKeys` registry-entry shape and category label — confirm
  against the merged app-config code (`SettingsService`, `ConfigKeys`) when adding the two
  `wallet.*` keys. Decision (inline edit on the Monitor tab reusing the `/api/admin/config`
  mutation) stands regardless; this is only verifying the code seam.
