# Ingestion UI Enhancements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show linked record name/ID and total processing time on job cards (live + history); switch the log viewer to a per-card inline expandable section rather than a full-page drawer; simplify the ZIP password UX.

**Architecture:** Backend adds `recordName` to the in-memory WS snapshot by fetching it from `RecordRepository` at job start and carrying it through `InMemoryTrackingService`. History endpoint enriches the response inline. Frontend destructures the new field and renders it on `JobCard` and in the history `DataGrid`. Log viewer gains a collapsible in-card section (keeping the existing drawer as an alternative for full-screen viewing).

**Tech Stack:** Spring Boot (Java 21), React 18, MUI v6, TanStack Query, Framer Motion, notistack, Zustand.

---

## File Map

| Action | File |
|--------|------|
| Modify | `db-world-backend/src/main/java/com/db/dbworld/app/media/ingestion/tracking/TrackingService.java` |
| Modify | `db-world-backend/src/main/java/com/db/dbworld/app/media/ingestion/tracking/impl/InMemoryTrackingService.java` |
| Modify | `db-world-backend/src/main/java/com/db/dbworld/app/media/ingestion/pipeline/DefaultIngestionPipeline.java` |
| Modify | `db-world-backend/src/main/java/com/db/dbworld/app/media/ingestion/controller/IngestionController.java` |
| Modify | `db-world-frontend/src/features/adminv2/ingestion/jobs/JobCard.jsx` |
| Modify | `db-world-frontend/src/features/adminv2/ingestion/history/JobHistory.jsx` |
| Modify | `db-world-frontend/src/features/adminv2/ingestion/form/IngestionForm.jsx` |

---

## Task 1 — Add `recordName` to `TrackingService` and `InMemoryTrackingService`

**Context:** `updateJobMeta()` currently accepts `(jobId, sourceType, fileName, uri, recordId)`. We need to add `recordName` so the WS broadcast includes a human-readable record name without an extra DB lookup on every WS tick.

**Files:**
- Modify: `db-world-backend/src/main/java/com/db/dbworld/app/media/ingestion/tracking/TrackingService.java`
- Modify: `db-world-backend/src/main/java/com/db/dbworld/app/media/ingestion/tracking/impl/InMemoryTrackingService.java`

- [ ] **Step 1.1 — Update `TrackingService` interface**

  Replace the `updateJobMeta` signature:

  ```java
  /** Store display metadata broadcast via WebSocket (sourceType, fileName, uri, recordId, recordName). */
  void updateJobMeta(String jobId, String sourceType, String fileName, String uri,
                     Long recordId, String recordName);
  ```

- [ ] **Step 1.2 — Update `JobState` in `InMemoryTrackingService`**

  Add `recordName` to the inner `JobState` class (after `volatile Long recordId`):

  ```java
  volatile String recordName;
  ```

- [ ] **Step 1.3 — Update `updateJobMeta()` implementation in `InMemoryTrackingService`**

  Replace the existing `updateJobMeta` method:

  ```java
  @Override
  public void updateJobMeta(String jobId, String sourceType, String fileName,
                            String uri, Long recordId, String recordName) {
      JobState state  = getOrCreate(jobId);
      state.sourceType = sourceType;
      state.fileName   = fileName;
      state.uri        = uri;
      state.recordId   = recordId;
      state.recordName = recordName;
  }
  ```

- [ ] **Step 1.4 — Include `recordName` in `toSummary()`**

  In `toSummary()`, after `map.put("recordId", state.recordId)`:

  ```java
  if (state.recordName != null) map.put("recordName", state.recordName);
  ```

- [ ] **Step 1.5 — Compile check**

  ```bash
  cd db-world-backend
  mvn compile -q
  ```

  Expected: BUILD FAILURE — callers of `updateJobMeta` now have the wrong arity. That is expected and will be fixed in the next task.

- [ ] **Step 1.6 — Commit (compile-broken — next task fixes callers)**

  ```bash
  git add db-world-backend/src/main/java/com/db/dbworld/app/media/ingestion/tracking/TrackingService.java \
          db-world-backend/src/main/java/com/db/dbworld/app/media/ingestion/tracking/impl/InMemoryTrackingService.java
  git commit -m "feat: add recordName to TrackingService.updateJobMeta and WS snapshot"
  ```

---

## Task 2 — Update All `updateJobMeta()` Callers in `DefaultIngestionPipeline`

**Context:** `DefaultIngestionPipeline` calls `trackingService.updateJobMeta(...)` three times (local file path, source resolve, and download completion). Each call must now pass `recordName`. The record name is fetched once via `RecordRepository` at the start of `execute()`.

**Files:**
- Modify: `db-world-backend/src/main/java/com/db/dbworld/app/media/ingestion/pipeline/DefaultIngestionPipeline.java`

- [ ] **Step 2.1 — Inject `RecordRepository` into `DefaultIngestionPipeline`**

  `DefaultIngestionPipeline` uses `@RequiredArgsConstructor`. Add the field:

  ```java
  private final com.db.dbworld.app.cinema.catalog.repository.RecordRepository recordRepository;
  ```

  Add import at top: `import com.db.dbworld.app.cinema.catalog.repository.RecordRepository;`

  **Note:** `DefaultIngestionPipeline` is instantiated via a Spring `@Configuration` `@Bean` (check `IngestionConfig.java` for the exact bean definition and add the parameter there too).

- [ ] **Step 2.2 — Add `resolveRecordName()` helper**

  Add this private method to `DefaultIngestionPipeline`:

  ```java
  private String resolveRecordName(Long recordId) {
      if (recordId == null) return null;
      try {
          return recordRepository.findById(recordId)
                  .map(r -> r.getName())
                  .orElse(null);
      } catch (Exception e) {
          log.warn("Could not resolve record name for id={}: {}", recordId, e.getMessage());
          return null;
      }
  }
  ```

- [ ] **Step 2.3 — Fetch `recordName` once at the top of `execute()`**

  At the very beginning of the `execute(IngestionContext ctx)` method, after `String jobId = ctx.getJobId()`:

  ```java
  // Resolve record name once — used in all updateJobMeta calls below
  final String recordName = resolveRecordName(ctx.getRequest().getRecordId());
  ```

- [ ] **Step 2.4 — Fix all three `updateJobMeta` call sites**

  Three occurrences in `execute()` and `runProcessing()`. Update each by appending `, recordName`:

  **Call 1** (local file path, around line 82):
  ```java
  trackingService.updateJobMeta(jobId, "LOCAL",
          localFile.getFileName().toString(), localFilePath,
          ctx.getRequest().getRecordId(), recordName);
  ```

  **Call 2** (source resolve, around line 101):
  ```java
  trackingService.updateJobMeta(jobId, ctx.getSource().getType(),
          null, ctx.getRequest().getUri(),
          ctx.getRequest().getRecordId(), recordName);
  ```

  **Call 3** (after download completes, around line 126):
  ```java
  trackingService.updateJobMeta(jobId, ctx.getSource().getType(),
          downloadResult.getFileName(), ctx.getRequest().getUri(),
          ctx.getRequest().getRecordId(), recordName);
  ```

  **Call 4** (in `runProcessing()`, when a processor returns a finalFile, around line 178):
  ```java
  trackingService.updateJobMeta(jobId,
          ctx.getSource() != null ? ctx.getSource().getType() : null,
          finalFileName,
          ctx.getRequest() != null ? ctx.getRequest().getUri() : null,
          ctx.getRecordId(), recordName);
  ```

- [ ] **Step 2.5 — Update `IngestionConfig` bean definition**

  Find `IngestionConfig.java` (`app/media/ingestion/config/IngestionConfig.java`) and add `RecordRepository recordRepository` as a parameter to the `DefaultIngestionPipeline` bean method, then pass it through.

  ```java
  // Example — adapt to the actual constructor call in IngestionConfig.java:
  @Bean
  public IngestionPipeline ingestionPipeline(
          List<SourceHandler> sourceHandlers,
          List<DownloadStrategy> downloadStrategies,
          List<ProcessingStrategy> processors,
          TrackingService trackingService,
          IngestionRepository ingestionRepository,
          ExecutorService jobExecutor,
          IngestionJobStore jobStore,
          IngestionDownloadQueue downloadQueue,
          RecordRepository recordRepository      // ADD THIS
  ) {
      return new DefaultIngestionPipeline(
              sourceHandlers, downloadStrategies, processors,
              trackingService, ingestionRepository,
              jobExecutor, jobStore, downloadQueue,
              recordRepository                   // ADD THIS
      );
  }
  ```

- [ ] **Step 2.6 — Compile check**

  ```bash
  cd db-world-backend
  mvn compile -q
  ```

  Expected: BUILD SUCCESS.

- [ ] **Step 2.7 — Commit**

  ```bash
  git add db-world-backend/src/main/java/com/db/dbworld/app/media/ingestion/pipeline/DefaultIngestionPipeline.java \
          db-world-backend/src/main/java/com/db/dbworld/app/media/ingestion/config/IngestionConfig.java
  git commit -m "feat: fetch and broadcast recordName in DefaultIngestionPipeline WS snapshots"
  ```

---

## Task 3 — Add `recordName` to History Response

**Context:** `IngestionController.getHistory()` returns `IngestionJobEntity` objects (which have `record_id` but no `record_name`). The frontend history table should also show the record name without a separate client-side lookup.

**Files:**
- Modify: `db-world-backend/src/main/java/com/db/dbworld/app/media/ingestion/controller/IngestionController.java`

- [ ] **Step 3.1 — Inject `RecordRepository` into `IngestionController`**

  Add to the constructor parameters:
  ```java
  private final RecordRepository recordRepository;
  ```

  Update the constructor to include this new parameter (follow the existing constructor pattern in the file).

  Add import: `import com.db.dbworld.app.cinema.catalog.repository.RecordRepository;`

- [ ] **Step 3.2 — Add `toHistoryDto()` helper**

  Add this private method to `IngestionController`:

  ```java
  private Map<String, Object> toHistoryDto(IngestionJobEntity e) {
      Map<String, Object> m = new java.util.LinkedHashMap<>();
      m.put("jobId",       e.getJobId());
      m.put("status",      e.getStatus());
      m.put("step",        e.getStep());
      m.put("sourceType",  e.getSourceType());
      m.put("uri",         e.getUri());
      m.put("fileName",    e.getFileName());
      m.put("totalBytes",  e.getTotalBytes());
      m.put("startedAt",   e.getStartedAt());
      m.put("completedAt", e.getCompletedAt());
      m.put("failReason",  e.getFailReason());
      m.put("recordId",    e.getRecordId());
      m.put("htmlReport",  null); // omit from list — use /report endpoint instead
      // Resolve record name
      if (e.getRecordId() != null) {
          String rName = recordRepository.findById(e.getRecordId())
                  .map(r -> r.getName()).orElse(null);
          m.put("recordName", rName);
      }
      return m;
  }
  ```

- [ ] **Step 3.3 — Update the history endpoint to use `toHistoryDto()`**

  Find the `getHistory()` method (GET /api/ingestion/history) in `IngestionController`. Update it to map entities through `toHistoryDto()`:

  ```java
  @GetMapping("/history")
  public ResponseEntity<?> getHistory() {
      List<Map<String, Object>> history = jobRepository.findAll(
              org.springframework.data.domain.Sort.by(
                      org.springframework.data.domain.Sort.Direction.DESC, "startedAt"))
              .stream()
              .map(this::toHistoryDto)
              .collect(java.util.stream.Collectors.toList());
      return ResponseEntity.ok(history);
  }
  ```

- [ ] **Step 3.4 — Compile check**

  ```bash
  cd db-world-backend
  mvn compile -q
  ```

  Expected: BUILD SUCCESS.

- [ ] **Step 3.5 — Full build**

  ```bash
  cd db-world-backend
  mvn package -DskipTests -q
  ```

  Expected: BUILD SUCCESS.

- [ ] **Step 3.6 — Commit**

  ```bash
  git add db-world-backend/src/main/java/com/db/dbworld/app/media/ingestion/controller/IngestionController.java
  git commit -m "feat: include recordName in history endpoint response"
  ```

---

## Task 4 — Update `JobCard.jsx` — Record Name, ID, and Total Processing Time

**Context:** `JobCard.jsx` currently shows `jobId.slice(0,8)…` and `elapsedMs` in a small footer. We need to add the linked record name (if any) as a subtitle under the filename, and format `elapsedMs` as a proper duration in the footer.

**Files:**
- Modify: `db-world-frontend/src/features/adminv2/ingestion/jobs/JobCard.jsx`

- [ ] **Step 4.1 — Destructure new fields from `job` prop**

  In the `JobCard` component (line 139), add `recordId` and `recordName` to the destructuring:

  ```jsx
  const {
    jobId, status = 'QUEUED', step, sourceType,
    fileName, uri, progress, failReason,
    startTime, elapsedMs, recordId, recordName,   // ADD recordId, recordName
  } = job;
  ```

- [ ] **Step 4.2 — Add record subtitle below the filename**

  In the header Stack (after the `<Tooltip>` containing the filename typography, around line 208), insert:

  ```jsx
  {recordName && (
    <Typography
      variant="caption"
      color="text.secondary"
      noWrap
      sx={{ display: 'block', ml: '26px', mt: '-2px', fontSize: '0.68rem' }}
    >
      #{recordId} · {recordName}
    </Typography>
  )}
  ```

- [ ] **Step 4.3 — Improve the footer to show formatted elapsed time**

  Replace the footer `<Typography>` (around lines 270–272):

  ```jsx
  <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5, display: 'block' }}>
    {jobId.slice(0, 8)}…
    {elapsedMs != null && ` · ${fmtDurationMs(elapsedMs)}`}
    {['SUCCESS', 'FAILED', 'CANCELLED'].includes(status) && elapsedMs > 0 && ' total'}
  </Typography>
  ```

- [ ] **Step 4.4 — Manual test**

  Start a job with a linked record. Verify the card shows:
  - File name in the main row
  - `#123 · Movie Title` subtitle below (caption-sized)
  - Footer with `{jobId-prefix}… · 2m 34s total` on completion

- [ ] **Step 4.5 — Commit**

  ```bash
  git add db-world-frontend/src/features/adminv2/ingestion/jobs/JobCard.jsx
  git commit -m "feat: show record name/ID and formatted elapsed time on job card"
  ```

---

## Task 5 — Update `JobHistory.jsx` — Add Record Name Column

**Context:** The history DataGrid has columns: Src, File, Status, Last step, Size, Started, Actions. We add a "Record" column showing `recordName` (with `recordId` as tooltip) between File and Status.

**Files:**
- Modify: `db-world-frontend/src/features/adminv2/ingestion/history/JobHistory.jsx`

- [ ] **Step 5.1 — Read `JobHistory.jsx` to find the columns array**

  The columns array is defined somewhere in `JobHistory.jsx`. Find the `const columns = [...]` definition.

- [ ] **Step 5.2 — Add Record column after the File column**

  Insert this column object after the File column entry:

  ```jsx
  {
    field: 'recordName',
    headerName: 'Record',
    width: 180,
    renderCell: ({ row }) =>
      row.recordName ? (
        <Tooltip title={`ID: ${row.recordId}`}>
          <Typography variant="caption" noWrap>{row.recordName}</Typography>
        </Tooltip>
      ) : (
        <Typography variant="caption" color="text.disabled">—</Typography>
      ),
  },
  ```

- [ ] **Step 5.3 — Add total processing time column (optional, add after Started)**

  ```jsx
  {
    field: 'duration',
    headerName: 'Duration',
    width: 100,
    valueGetter: ({ row }) => {
      if (!row.startedAt || !row.completedAt) return null;
      return Math.round((new Date(row.completedAt) - new Date(row.startedAt)) / 1000);
    },
    renderCell: ({ value }) => {
      if (!value) return <Typography variant="caption" color="text.disabled">—</Typography>;
      const h = Math.floor(value / 3600);
      const m = Math.floor((value % 3600) / 60);
      const s = value % 60;
      const label = h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`;
      return <Typography variant="caption">{label}</Typography>;
    },
  },
  ```

- [ ] **Step 5.4 — Manual test**

  Open the History tab. Verify the Record column shows record names for linked jobs, and "—" for jobs without a record.

- [ ] **Step 5.5 — Commit**

  ```bash
  git add db-world-frontend/src/features/adminv2/ingestion/history/JobHistory.jsx
  git commit -m "feat: record name and duration columns in job history DataGrid"
  ```

---

## Task 6 — Inline Log Expansion in `JobCard`

**Context:** Logs currently open in a full-width right-side drawer (`LogViewerDrawer`). For live jobs, an inline expandable section below the card content provides faster access without covering the rest of the page. The existing drawer is kept as the "full-view" option.

**Files:**
- Modify: `db-world-frontend/src/features/adminv2/ingestion/jobs/JobCard.jsx`

- [ ] **Step 6.1 — Add `logInlineOpen` state and fetch logic**

  After the existing `const [logOpen, setLogOpen] = useState(false)` in `JobCard`:

  ```jsx
  const [logInlineOpen, setLogInlineOpen] = useState(false);
  const [inlineHtml, setInlineHtml]       = useState(null);
  const [inlineLoading, setInlineLoading] = useState(false);

  const fetchInlineLogs = async () => {
    if (inlineHtml) return; // already fetched
    setInlineLoading(true);
    try {
      const { getJobReport } = await import('../services/ingestionApi');
      const html = await getJobReport(jobId);
      setInlineHtml(html);
    } catch {
      setInlineHtml('<p style="color:red">Failed to load logs.</p>');
    } finally {
      setInlineLoading(false);
    }
  };

  const toggleInlineLogs = () => {
    if (!logInlineOpen) fetchInlineLogs();
    setLogInlineOpen(prev => !prev);
  };
  ```

- [ ] **Step 6.2 — Add "Logs" toggle button next to the existing actions**

  In the header Stack (right side, near `<JobActions>`), add a Logs button. Find the line with `<JobActions job={job} onLogView={() => setLogOpen(true)} />` (around line 220) and update the surrounding Stack:

  ```jsx
  <Stack direction="row" spacing={0.75} alignItems="center" flexShrink={0}>
    <Chip
      icon={<cfg.Icon sx={{ fontSize: '12px !important' }} />}
      label={statusLabel}
      color={cfg.color}
      size="small"
      sx={{ fontSize: '0.7rem', height: 22 }}
    />
    <Tooltip title={logInlineOpen ? 'Collapse logs' : 'Expand logs inline'}>
      <IconButton size="small" onClick={toggleInlineLogs} sx={{ p: 0.5 }}>
        {logInlineOpen ? <ExpandLess sx={{ fontSize: 16 }} /> : <ExpandMore sx={{ fontSize: 16 }} />}
      </IconButton>
    </Tooltip>
    <JobActions job={job} onLogView={() => setLogOpen(true)} />
  </Stack>
  ```

  Add the imports needed at the top of the file:
  ```jsx
  import { ExpandMore, ExpandLess } from '@mui/icons-material';
  import { Collapse, IconButton } from '@mui/material';
  ```

- [ ] **Step 6.3 — Add inline log panel after the fail reason block**

  After the `{failReason && ...}` block and before the footer `<Typography>`, insert:

  ```jsx
  {/* ── Inline log panel ───────────────────────────────────────── */}
  <Collapse in={logInlineOpen} unmountOnExit>
    <Box
      sx={{
        mt: 1,
        border: `1px solid ${alpha(T.text, 0.1)}`,
        borderRadius: 1,
        overflow: 'hidden',
        maxHeight: 300,
      }}
    >
      {inlineLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress size={20} />
        </Box>
      ) : (
        <iframe
          srcDoc={inlineHtml ?? ''}
          title="Job logs"
          style={{ width: '100%', height: 280, border: 'none' }}
          sandbox="allow-same-origin"
        />
      )}
    </Box>
  </Collapse>
  ```

  Add `CircularProgress` to the existing MUI import list at the top of the file.

- [ ] **Step 6.4 — Manual test**

  Click the expand icon on a live or completed job card. Verify the log section expands inline below the card content. Clicking again collapses it. The existing drawer ("full screen" icon in JobActions) still works.

- [ ] **Step 6.5 — Commit**

  ```bash
  git add db-world-frontend/src/features/adminv2/ingestion/jobs/JobCard.jsx
  git commit -m "feat: inline collapsible log panel on job cards"
  ```

---

## Task 7 — Simplify ZIP Password UX in `IngestionForm`

**Context:** Currently there are two separate toggles: "Extract ZIP/RAR/7z" and "ZIP password", making the UX confusing. Simplify to: once "Extract" is toggled on, show a single optional password field (with an eye/lock icon, collapsed by default).

**Files:**
- Modify: `db-world-frontend/src/features/adminv2/ingestion/form/IngestionForm.jsx`

- [ ] **Step 7.1 — Read the current ZIP section (lines 569–613 of `IngestionForm.jsx`)**

  Locate the section that renders the extract toggle, useZipPwd toggle, and zipPwd field.

- [ ] **Step 7.2 — Replace the ZIP section with a simplified single-password field**

  Replace the existing ZIP section (the extract toggle + two nested toggles) with:

  ```jsx
  {/* ── Extract toggle ─────────────────────────────────────── */}
  <Controller
    name="extract"
    control={control}
    render={({ field }) => (
      <FormControlLabel
        control={<Switch {...field} checked={field.value} size="small" />}
        label="Extract ZIP / RAR / 7z after download"
      />
    )}
  />

  {/* ── ZIP password (shown only when extract is on) ──────── */}
  {watchExtract && (
    <Controller
      name="zipPwd"
      control={control}
      render={({ field, fieldState }) => (
        <TextField
          {...field}
          label="Archive password (optional)"
          type="password"
          size="small"
          fullWidth
          error={!!fieldState.error}
          helperText={fieldState.error?.message ?? 'Leave blank if the archive has no password'}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <LockOutlined sx={{ fontSize: 16, color: 'text.disabled' }} />
              </InputAdornment>
            ),
          }}
          sx={getFieldSx(T)}
        />
      )}
    />
  )}
  ```

  Add `watchExtract` watch call near the other `watch` calls in the form:
  ```jsx
  const watchExtract = watch('extract');
  ```

  Update the form submission to pass `extractPassword` directly from `zipPwd` when extract is enabled:
  ```jsx
  // In the body builder (existing submission handler):
  extractPassword: data.extract && data.zipPwd ? data.zipPwd : undefined,
  ```

  Remove `useZipPwd` from the Zod schema and form state (it's no longer needed). The schema for the ZIP fields becomes:
  ```js
  extract: z.boolean().default(false),
  zipPwd:  z.string().optional(),
  ```

  Add the missing icon import:
  ```jsx
  import { LockOutlined } from '@mui/icons-material';
  ```

- [ ] **Step 7.3 — Manual test**

  1. Toggle "Extract ZIP / RAR / 7z" off → password field is hidden.
  2. Toggle it on → password field appears with placeholder text.
  3. Submit without a password → `extractPassword` is undefined in request.
  4. Submit with a password → `extractPassword` is sent.

- [ ] **Step 7.4 — Commit**

  ```bash
  git add db-world-frontend/src/features/adminv2/ingestion/form/IngestionForm.jsx
  git commit -m "ux: simplify ZIP password to single optional field when extract is enabled"
  ```

---

## Self-Review Checklist

| Requirement | Task |
|-------------|------|
| Linked record ID on job cards | Task 4 |
| Record name on job cards | Task 1 + 4 |
| Total processing time on job cards | Task 4 (elapsedMs formatted) |
| Record name in history | Task 3 + 5 |
| Total processing time in history | Task 5 (duration column) |
| Log viewer inline alternative | Task 6 |
| ZIP extraction password UX simplified | Task 7 |
| Backend WS payload includes recordName | Task 1 + 2 |
