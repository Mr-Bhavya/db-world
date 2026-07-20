# Backend Track Processing Enhancements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve FFmpeg enrichment with smart language-based track filtering, proper per-track audio/subtitle metadata (language, title, default), correct series global title format, multi/dual audio in filenames, and robust 7z error handling.

**Architecture:** All changes live in the backend Java modules. `SmartTrackFilterService` (new) probes audio/subtitle languages via MediaInfo before FFmpeg runs, then builds the appropriate `TrackFilter`. `TmdbMediaEnrichmentServiceImpl` is extended to write per-track `language=`, `title=`, and `disposition` metadata for audio and subtitle streams. `ProcessExecutor` treats 7z exit-code 1 (warnings) as success and accepts an optional password arg.

**Tech Stack:** Java 21, Spring Boot, FFmpeg (stream mapping/metadata), 7-Zip CLI (`7z`), MediaInfo CLI (`--output=JSON`), Lombok, Jackson.

---

## File Map

| Action  | File |
|---------|------|
| Modify  | `db-world-backend/src/main/java/com/db/dbworld/app/media/enrichment/TrackFilter.java` |
| Create  | `db-world-backend/src/main/java/com/db/dbworld/app/media/enrichment/SmartTrackFilterService.java` |
| Modify  | `db-world-backend/src/main/java/com/db/dbworld/app/media/enrichment/impl/TmdbMediaEnrichmentServiceImpl.java` |
| Modify  | `db-world-backend/src/main/java/com/db/dbworld/core/processor/ProcessExecutor.java` |
| Modify  | `db-world-backend/src/main/java/com/db/dbworld/app/media/ingestion/processing/strategy/ExtractionProcessingStrategy.java` |
| Modify  | `db-world-backend/src/main/java/com/db/dbworld/app/media/ingestion/processing/strategy/FfmpegProcessingStrategy.java` |

---

## Task 1 — Fix 7z Exit-Code Handling and Add Password Support

**Context:** `ProcessExecutor.executeExtraction()` uses `successPredicate(code -> code == 0)`. 7-Zip exits with code **1** for warnings (e.g., "there are data after the end of the archive") — these are non-fatal but currently treated as failures. Additionally, the extraction command doesn't pass a password even when `IngestionRequest.extractPassword` is set.

**Files:**
- Modify: `db-world-backend/src/main/java/com/db/dbworld/core/processor/ProcessExecutor.java` (lines 178–210)
- Modify: `db-world-backend/src/main/java/com/db/dbworld/app/media/ingestion/processing/strategy/ExtractionProcessingStrategy.java` (lines 56–64)

- [ ] **Step 1.1 — Update `executeExtraction` signature and success predicate**

  Replace the existing `executeExtraction` method (lines 178–210 of `ProcessExecutor.java`) with:

  ```java
  public void executeExtraction(
          String archivePath,
          String outputPath,
          String password,            // NEW — null means no password
          StreamProcessor streamProcessor,
          AtomicBoolean cancellationFlag,
          Duration timeout
  ) throws ProcessExecutionException {

      List<String> cmdList = new ArrayList<>();
      cmdList.add(runtimeProperties.getSevenZip());
      cmdList.addAll(List.of("x", "-bsp1", "-bb1", archivePath, "-o" + outputPath, "-aoa"));
      if (password != null && !password.isBlank()) {
          cmdList.add("-p" + password);   // password must immediately follow -p, no space
      }
      String[] command = cmdList.toArray(new String[0]);

      ProcessResult result = execute(
              ProcessConfiguration.builder()
                      .command(command)
                      .outputProcessor(streamProcessor.stdoutConsumer())
                      .errorProcessor(streamProcessor.stderrConsumer())
                      .cancellationFlag(cancellationFlag)
                      .timeout(timeout)
                      .successPredicate(code -> code == 0 || code == 1)  // 1 = warnings, not errors
                      .build()
      );

      if (!result.success()) {
          throw ProcessExecutionException.forExitCode(
                  result.exitCode(),
                  String.join(" ", command)
          );
      }
  }
  ```

- [ ] **Step 1.2 — Update `ExtractionProcessingStrategy` to pass password**

  Replace the `processExecutor.executeExtraction(...)` call (lines 58–64 of `ExtractionProcessingStrategy.java`) with:

  ```java
  processExecutor.executeExtraction(
          archivePath.toAbsolutePath().toString(),
          extractDir.toAbsolutePath().toString(),
          ctx.getRequest().getExtractPassword(),   // NEW
          buildStreamProcessor(ctx),
          ctx.getCancellationFlag(),
          Duration.ofHours(2)
  );
  ```

- [ ] **Step 1.3 — Manual test**

  Start a job with a non-fatal-warning archive (e.g., a zip with a trailing byte). Verify the job completes with SUCCESS instead of FAILED. Verify a password-protected zip is extracted correctly when `extractPassword` is provided in the request.

- [ ] **Step 1.4 — Commit**

  ```bash
  git add db-world-backend/src/main/java/com/db/dbworld/core/processor/ProcessExecutor.java \
          db-world-backend/src/main/java/com/db/dbworld/app/media/ingestion/processing/strategy/ExtractionProcessingStrategy.java
  git commit -m "fix: 7z exit-code 1 treated as warning; pass extractPassword to 7z"
  ```

---

## Task 2 — Extend `TrackFilter` with Subtitle Filtering and Track Disposition Fields

**Context:** `TrackFilter` only handles audio language filtering and a few boolean flags. We need subtitle language filtering (mirroring audio) and a flag to mark which audio track should be default.

**Files:**
- Modify: `db-world-backend/src/main/java/com/db/dbworld/app/media/enrichment/TrackFilter.java`

- [ ] **Step 2.1 — Replace the body of `TrackFilter.java`**

  ```java
  package com.db.dbworld.app.media.enrichment;

  import lombok.AllArgsConstructor;
  import lombok.Builder;
  import lombok.Getter;
  import lombok.NoArgsConstructor;

  import java.util.List;

  /**
   * Optional track-selection directives applied during TMDB enrichment.
   *
   * All operations are folded into the SAME single FFmpeg pass as:
   * cover-art embedding, title metadata, and file renaming.
   * Null / default values mean "keep as-is".
   *
   * Example — keep Hindi + English audio, Hindi subtitle only, Hindi as default:
   * <pre>
   *   TrackFilter.builder()
   *       .keepAudioLanguages(List.of("hin", "eng"))
   *       .keepSubtitleLanguages(List.of("hin"))
   *       .defaultAudioLanguage("hin")
   *       .noDefaultSubtitle(true)
   *       .build()
   * </pre>
   */
  @Getter
  @Builder
  @NoArgsConstructor
  @AllArgsConstructor
  public class TrackFilter {

      /**
       * ISO 639-2/B language codes for audio tracks to retain (e.g. "hin", "eng", "guj").
       * Audio tracks whose {@code language} tag is NOT in this list are dropped.
       * {@code null} = keep all audio tracks.
       */
      private List<String> keepAudioLanguages;

      /**
       * ISO 639-2/B language codes for subtitle/text tracks to retain.
       * {@code null}       = keep all subtitle tracks.
       * Empty {@code List} = remove ALL subtitle tracks.
       */
      private List<String> keepSubtitleLanguages;

      /**
       * Language code of the audio track that should be marked as default
       * (e.g. "hin"). Must be present in {@code keepAudioLanguages} if that
       * list is non-null. {@code null} = use the first kept track as default.
       */
      private String defaultAudioLanguage;

      /**
       * When {@code true}, no subtitle track is set as default (disposition = 0).
       * Recommended default: {@code true}.
       */
      @Builder.Default
      private boolean noDefaultSubtitle = true;

      /**
       * Drop ALL subtitle/text streams (legacy flag; prefer empty keepSubtitleLanguages).
       * Default: {@code false}.
       */
      @Builder.Default
      private boolean removeAllSubtitles = false;

      /**
       * Keep only the first real video stream (stream index 0).
       * Default: {@code false}.
       */
      @Builder.Default
      private boolean keepFirstVideoOnly = false;

      /** Returns {@code true} if any filtering or metadata directive is requested. */
      public boolean hasAnyFilter() {
          return removeAllSubtitles
                  || keepFirstVideoOnly
                  || noDefaultSubtitle
                  || defaultAudioLanguage != null
                  || (keepAudioLanguages != null && !keepAudioLanguages.isEmpty())
                  || keepSubtitleLanguages != null;
      }
  }
  ```

- [ ] **Step 2.2 — Compile check**

  ```bash
  cd db-world-backend
  mvn compile -q
  ```

  Expected: BUILD SUCCESS (no new fields break existing callers since Lombok builder is backwards-compatible — all new fields are optional).

- [ ] **Step 2.3 — Commit**

  ```bash
  git add db-world-backend/src/main/java/com/db/dbworld/app/media/enrichment/TrackFilter.java
  git commit -m "feat: TrackFilter — add keepSubtitleLanguages, defaultAudioLanguage, noDefaultSubtitle"
  ```

---

## Task 3 — Create `SmartTrackFilterService`

**Context:** When a user starts an ingestion without specifying a `TrackFilter`, we should auto-detect which of the priority languages (Hindi `hin`, English `eng`, Gujarati `guj`) are present in the file and apply filtering only to those. If NONE of the priority languages are present, return `null` (no filter = keep everything).

**Files:**
- Create: `db-world-backend/src/main/java/com/db/dbworld/app/media/enrichment/SmartTrackFilterService.java`

- [ ] **Step 3.1 — Create `SmartTrackFilterService.java`**

  ```java
  package com.db.dbworld.app.media.enrichment;

  import com.db.dbworld.core.processor.ProcessExecutor;
  import com.fasterxml.jackson.databind.JsonNode;
  import com.fasterxml.jackson.databind.ObjectMapper;
  import lombok.RequiredArgsConstructor;
  import lombok.extern.log4j.Log4j2;
  import org.springframework.stereotype.Service;

  import java.nio.file.Path;
  import java.util.ArrayList;
  import java.util.HashSet;
  import java.util.List;
  import java.util.Set;

  /**
   * Resolves the effective {@link TrackFilter} for a media file by probing
   * its actual track languages via MediaInfo before FFmpeg runs.
   *
   * Priority language order: Hindi (hin) → English (eng) → Gujarati (guj).
   * - If any priority language exists in the file: filter audio/subtitles to
   *   those priority languages only, with Hindi as default audio.
   * - If NO priority language exists: return {@code null} (keep all tracks).
   * - If the caller already provided a non-empty filter, use it as-is.
   */
  @Log4j2
  @Service
  @RequiredArgsConstructor
  public class SmartTrackFilterService {

      private static final List<String> PRIORITY_LANGS = List.of("hin", "eng", "guj");

      private final ProcessExecutor processExecutor;
      private final ObjectMapper    objectMapper;

      /**
       * @param mediaFile  the input media file to probe
       * @param userFilter the caller-supplied filter (may be null or empty)
       * @return effective TrackFilter to use, or {@code null} if no filtering is needed
       */
      public TrackFilter resolve(Path mediaFile, TrackFilter userFilter) {
          // Honour an explicit user-provided filter
          if (userFilter != null && userFilter.hasAnyFilter()) {
              return userFilter;
          }

          TrackLanguages langs = probeLanguages(mediaFile);

          List<String> keepAudio = PRIORITY_LANGS.stream()
                  .filter(langs.audio()::contains)
                  .collect(java.util.stream.Collectors.toList());

          List<String> keepSubs = PRIORITY_LANGS.stream()
                  .filter(langs.subtitles()::contains)
                  .collect(java.util.stream.Collectors.toList());

          if (keepAudio.isEmpty() && keepSubs.isEmpty()) {
              log.debug("No priority languages found in {} — track filter skipped", mediaFile.getFileName());
              return null;
          }

          log.debug("Smart filter for {}: audio={}, subs={}", mediaFile.getFileName(), keepAudio, keepSubs);

          return TrackFilter.builder()
                  .keepAudioLanguages(keepAudio.isEmpty() ? null : keepAudio)
                  .keepSubtitleLanguages(keepSubs.isEmpty() ? null : keepSubs)
                  .defaultAudioLanguage(keepAudio.contains("hin") ? "hin"
                          : keepAudio.isEmpty() ? null : keepAudio.get(0))
                  .noDefaultSubtitle(true)
                  .build();
      }

      // ──────────────────────────────────────────────────────────────────────

      private TrackLanguages probeLanguages(Path file) {
          Set<String> audioLangs = new HashSet<>();
          Set<String> subLangs   = new HashSet<>();
          try {
              String json = processExecutor.runMediaInfoCommand(file);
              JsonNode root   = objectMapper.readTree(json);
              JsonNode tracks = root.path("media").path("track");
              for (JsonNode track : tracks) {
                  String type = track.path("@type").asText("");
                  String lang = track.path("Language").asText("").toLowerCase().trim();
                  if (lang.isBlank()) continue;
                  // Normalise: MediaInfo sometimes returns "hi" instead of "hin"
                  lang = normaliseIso(lang);
                  if ("Audio".equals(type)) audioLangs.add(lang);
                  else if ("Text".equals(type)) subLangs.add(lang);
              }
          } catch (Exception e) {
              log.warn("Failed to probe track languages for {}: {}", file.getFileName(), e.getMessage());
          }
          return new TrackLanguages(audioLangs, subLangs);
      }

      /**
       * MediaInfo sometimes returns ISO 639-1 (2-letter) codes.
       * Normalise the most common ones to ISO 639-2/B (3-letter).
       */
      private String normaliseIso(String code) {
          return switch (code) {
              case "hi"  -> "hin";
              case "en"  -> "eng";
              case "gu"  -> "guj";
              case "ta"  -> "tam";
              case "te"  -> "tel";
              case "ja"  -> "jpn";
              case "ko"  -> "kor";
              case "zh"  -> "chi";
              case "fr"  -> "fra";
              case "es"  -> "spa";
              default    -> code;
          };
      }

      private record TrackLanguages(Set<String> audio, Set<String> subtitles) {}
  }
  ```

- [ ] **Step 3.2 — Compile check**

  ```bash
  cd db-world-backend
  mvn compile -q
  ```

  Expected: BUILD SUCCESS.

- [ ] **Step 3.3 — Commit**

  ```bash
  git add db-world-backend/src/main/java/com/db/dbworld/app/media/enrichment/SmartTrackFilterService.java
  git commit -m "feat: SmartTrackFilterService — auto-detect priority-language tracks before FFmpeg"
  ```

---

## Task 4 — Wire `SmartTrackFilterService` into `FfmpegProcessingStrategy`

**Context:** `FfmpegProcessingStrategy.enrichWithTmdb()` passes `ctx.getRequest().getTrackFilter()` directly to `enrichmentService.enrich()`. We need to resolve the effective filter through `SmartTrackFilterService` first.

**Files:**
- Modify: `db-world-backend/src/main/java/com/db/dbworld/app/media/ingestion/processing/strategy/FfmpegProcessingStrategy.java`

- [ ] **Step 4.1 — Inject `SmartTrackFilterService` into `FfmpegProcessingStrategy`**

  Add the field to the existing `@RequiredArgsConstructor` class (all fields are constructor-injected by Lombok):

  At the top of the class, after the existing fields:
  ```java
  // add this field alongside existing ones:
  private final SmartTrackFilterService smartTrackFilterService;
  ```

  The import: `import com.db.dbworld.app.media.enrichment.SmartTrackFilterService;`

- [ ] **Step 4.2 — Update `enrichWithTmdb()` to use resolved filter**

  Replace the existing `enrichWithTmdb` method body (lines 209–241):

  ```java
  private Path enrichWithTmdb(IngestionContext ctx, Path movedFile) {
      try {
          EpisodeRef episodeRef = resolveEpisodeRef(ctx, movedFile);

          if (episodeRef != null && ctx.getRequest().getSeason() == null) {
              ctx.getRequest().setSeason(episodeRef.season());
              ctx.getRequest().setEpisode(episodeRef.episode());
          }

          // ── Resolve effective track filter ────────────────────────────────
          TrackFilter effectiveFilter = smartTrackFilterService.resolve(
                  movedFile, ctx.getRequest().getTrackFilter());
          // ─────────────────────────────────────────────────────────────────

          Path enriched = enrichmentService.enrich(
                  movedFile,
                  ctx.getRecordId(),
                  episodeRef != null ? episodeRef.season() : null,
                  episodeRef != null ? episodeRef.episode() : null,
                  effectiveFilter,
                  ctx.getJobId()
          );
          if (!enriched.equals(movedFile)) {
              ctx.log("FFMPEG", "Enriched → " + enriched.getFileName());
          } else {
              ctx.log("FFMPEG", "Final file → " + enriched.getFileName());
          }
          return enriched;
      } catch (Exception e) {
          ctx.logError("FFMPEG", "Enrichment failed (non-fatal): " + e.getMessage());
          return movedFile;
      }
  }
  ```

  Add import at top of file: `import com.db.dbworld.app.media.enrichment.TrackFilter;`

- [ ] **Step 4.3 — Compile check**

  ```bash
  cd db-world-backend
  mvn compile -q
  ```

  Expected: BUILD SUCCESS.

- [ ] **Step 4.4 — Commit**

  ```bash
  git add db-world-backend/src/main/java/com/db/dbworld/app/media/ingestion/processing/strategy/FfmpegProcessingStrategy.java
  git commit -m "feat: wire SmartTrackFilterService into FfmpegProcessingStrategy"
  ```

---

## Task 5 — FFmpeg Per-Track Audio Metadata (language, title, default disposition)

**Context:** Currently `TmdbMediaEnrichmentServiceImpl.runFfmpegOnePass()` only sets a global `title` tag and a video track title equal to the movie name. It sets no per-track audio metadata. We need language tags, human-readable titles, and Hindi as the default audio track.

**Files:**
- Modify: `db-world-backend/src/main/java/com/db/dbworld/app/media/enrichment/impl/TmdbMediaEnrichmentServiceImpl.java`

- [ ] **Step 5.1 — Add `LANG_CODE_TO_NAME` map and helper in `TmdbMediaEnrichmentServiceImpl`**

  Add as a static field at the top of the class (after the existing pattern constants):

  ```java
  private static final java.util.Map<String, String> LANG_CODE_TO_NAME = java.util.Map.ofEntries(
      java.util.Map.entry("hin", "Hindi"),
      java.util.Map.entry("eng", "English"),
      java.util.Map.entry("guj", "Gujarati"),
      java.util.Map.entry("tam", "Tamil"),
      java.util.Map.entry("tel", "Telugu"),
      java.util.Map.entry("jpn", "Japanese"),
      java.util.Map.entry("kor", "Korean"),
      java.util.Map.entry("chi", "Chinese"),
      java.util.Map.entry("fra", "French"),
      java.util.Map.entry("spa", "Spanish"),
      java.util.Map.entry("ara", "Arabic"),
      java.util.Map.entry("por", "Portuguese"),
      java.util.Map.entry("ger", "German"),
      java.util.Map.entry("ita", "Italian"),
      java.util.Map.entry("rus", "Russian"),
      java.util.Map.entry("tha", "Thai"),
      java.util.Map.entry("vie", "Vietnamese"),
      java.util.Map.entry("msa", "Malay"),
      java.util.Map.entry("und", "Unknown")
  );

  private String langName(String code) {
      if (code == null || code.isBlank()) return null;
      return LANG_CODE_TO_NAME.getOrDefault(code.toLowerCase().trim(), code);
  }
  ```

- [ ] **Step 5.2 — Add `applyAudioTrackMetadata()` helper method**

  Add this private method to `TmdbMediaEnrichmentServiceImpl` (before `runFfmpegOnePass`):

  ```java
  /**
   * Appends per-audio-track language, title, and disposition metadata to the FFmpeg command.
   * Assumes audio tracks in the output are ordered as: index 0 = langs.get(0), etc.
   * (This holds because we use -map 0:a:m:language:X? in priority order.)
   */
  private void applyAudioTrackMetadata(List<String> cmd, TrackFilter filter) {
      if (filter == null || filter.getKeepAudioLanguages() == null
              || filter.getKeepAudioLanguages().isEmpty()) {
          return;
      }
      List<String> langs = filter.getKeepAudioLanguages();

      // Determine which index gets the default disposition
      String defaultLang = filter.getDefaultAudioLanguage();
      int defaultIdx = 0;
      if (defaultLang != null) {
          int found = langs.indexOf(defaultLang);
          if (found >= 0) defaultIdx = found;
      }

      for (int i = 0; i < langs.size(); i++) {
          String lang = langs.get(i);
          String name = langName(lang);

          // Language tag (ISO 639-2/B)
          cmd.addAll(List.of("-metadata:s:a:" + i, "language=" + lang));

          // Human-readable title
          if (name != null) {
              cmd.addAll(List.of("-metadata:s:a:" + i, "title=" + name));
          }

          // Default disposition: exactly one track is default, rest are 0
          cmd.addAll(List.of("-disposition:a:" + i, i == defaultIdx ? "default" : "0"));
      }
  }
  ```

- [ ] **Step 5.3 — Add `applySubtitleTrackMetadata()` helper method**

  ```java
  /**
   * Appends per-subtitle-track language, title, and disposition metadata.
   * Subtitle tracks are ordered in the output as: index 0 = subLangs.get(0), etc.
   */
  private void applySubtitleTrackMetadata(List<String> cmd, TrackFilter filter) {
      if (filter == null || filter.getKeepSubtitleLanguages() == null
              || filter.getKeepSubtitleLanguages().isEmpty()) {
          // If removeAllSubtitles or no subtitle filter, nothing to annotate
          return;
      }
      List<String> subLangs = filter.getKeepSubtitleLanguages();

      for (int i = 0; i < subLangs.size(); i++) {
          String lang = subLangs.get(i);
          String name = langName(lang);

          cmd.addAll(List.of("-metadata:s:s:" + i, "language=" + lang));
          if (name != null) {
              cmd.addAll(List.of("-metadata:s:s:" + i, "title=" + name));
          }

          // No subtitle set as default by default
          if (filter.isNoDefaultSubtitle()) {
              cmd.addAll(List.of("-disposition:s:" + i, "0"));
          }
      }
  }
  ```

- [ ] **Step 5.4 — Compile check**

  ```bash
  cd db-world-backend
  mvn compile -q
  ```

  Expected: BUILD SUCCESS.

- [ ] **Step 5.5 — Commit**

  ```bash
  git add db-world-backend/src/main/java/com/db/dbworld/app/media/enrichment/impl/TmdbMediaEnrichmentServiceImpl.java
  git commit -m "feat: audio/subtitle track metadata helpers in TmdbMediaEnrichmentServiceImpl"
  ```

---

## Task 6 — Rewrite `runFfmpegOnePass()` to Apply All Track Metadata

**Context:** The existing `runFfmpegOnePass()` in `TmdbMediaEnrichmentServiceImpl` sets global title and video track title but does not apply per-track audio/subtitle metadata. It also needs to:
1. Apply subtitle language filtering (using new `keepSubtitleLanguages`).
2. Remove the "-metadata:s:v:0 title={movieName}" line — the video track title should reflect the stream's own properties, not the movie name. The global `title` tag retains the movie/series name.
3. Call the new `applyAudioTrackMetadata()` and `applySubtitleTrackMetadata()` helpers after stream mapping.

**Files:**
- Modify: `db-world-backend/src/main/java/com/db/dbworld/app/media/enrichment/impl/TmdbMediaEnrichmentServiceImpl.java` (method `runFfmpegOnePass`, lines 209–313)

- [ ] **Step 6.1 — Replace `runFfmpegOnePass()` with the updated version**

  Replace the entire `runFfmpegOnePass` method with:

  ```java
  private void runFfmpegOnePass(Path input, Path poster, Path output,
                                String metadataTitle, String overview, TrackFilter filter,
                                String jobId) throws ProcessExecutionException {
      String inputName     = input.getFileName().toString().toLowerCase(java.util.Locale.ROOT);
      boolean isMkv        = inputName.endsWith(".mkv");
      boolean hasPoster    = poster != null && Files.exists(poster);
      boolean posterAsInput  = hasPoster && !isMkv;
      boolean posterAsAttach = hasPoster && isMkv;

      List<String> cmd = new ArrayList<>();
      cmd.add("-y");
      cmd.add("-progress");
      cmd.add("pipe:2");
      cmd.add("-nostats");
      cmd.addAll(List.of("-i", input.toAbsolutePath().toString()));

      if (posterAsInput) {
          cmd.addAll(List.of("-i", poster.toAbsolutePath().toString()));
      }

      // Clear all global metadata from input so we start clean
      cmd.addAll(List.of("-map_metadata", "-1"));

      boolean hasFilter = filter != null && filter.hasAnyFilter();

      // ── Stream mapping ────────────────────────────────────────────────────
      if (!hasFilter) {
          // Case A / B: simple copy
          cmd.addAll(List.of("-map", "0"));
          if (posterAsInput) cmd.addAll(List.of("-map", "1"));
      } else {
          // Case C: selective mapping — start with all, subtract unwanted
          cmd.addAll(List.of("-map", "0"));

          if (filter.isKeepFirstVideoOnly()) {
              cmd.addAll(List.of("-map", "-0:v"));
              cmd.addAll(List.of("-map", "0:v:0"));
          }

          // Audio filtering
          if (filter.getKeepAudioLanguages() != null && !filter.getKeepAudioLanguages().isEmpty()) {
              cmd.addAll(List.of("-map", "-0:a"));
              for (String lang : filter.getKeepAudioLanguages()) {
                  cmd.addAll(List.of("-map", "0:a:m:language:" + lang + "?"));
              }
          }

          // Subtitle filtering — keepSubtitleLanguages takes precedence over removeAllSubtitles
          if (filter.getKeepSubtitleLanguages() != null) {
              cmd.addAll(List.of("-map", "-0:s")); // remove all first
              for (String lang : filter.getKeepSubtitleLanguages()) {
                  // empty list means remove all — no re-add loop runs
                  cmd.addAll(List.of("-map", "0:s:m:language:" + lang + "?"));
              }
          } else if (filter.isRemoveAllSubtitles()) {
              cmd.addAll(List.of("-map", "-0:s"));
          }

          if (posterAsInput) cmd.addAll(List.of("-map", "1"));
      }

      cmd.addAll(List.of("-c", "copy"));

      if (posterAsInput) {
          cmd.addAll(List.of("-disposition:v:1", "attached_pic"));
          cmd.addAll(List.of("-metadata:s:v:1", "mimetype=image/jpeg"));
      }

      // ── Per-track metadata ────────────────────────────────────────────────
      applyAudioTrackMetadata(cmd, filter);
      applySubtitleTrackMetadata(cmd, filter);

      // ── Global metadata ───────────────────────────────────────────────────
      if (metadataTitle != null && !metadataTitle.isBlank()) {
          cmd.addAll(List.of("-metadata", "title=" + metadataTitle));
          // NOTE: do NOT set -metadata:s:v:0 title here (that overwrites the
          // stream's own codec title with the movie name — not desired)
      }
      if (overview != null && !overview.isBlank()) {
          cmd.addAll(List.of("-metadata", "description=" + overview));
          cmd.addAll(List.of("-metadata", "comment=" + overview));
      }

      // ── MKV cover art as attachment ───────────────────────────────────────
      if (posterAsAttach) {
          String posterName = poster.getFileName().toString();
          String mime       = posterName.endsWith(".png") ? "image/png" : "image/jpeg";
          String coverName  = posterName.endsWith(".png") ? "cover.png" : "cover.jpg";
          cmd.addAll(List.of("-attach", poster.toAbsolutePath().toString()));
          cmd.addAll(List.of("-metadata:s:t:0", "mimetype=" + mime));
          cmd.addAll(List.of("-metadata:s:t:0", "filename=" + coverName));
      }

      cmd.add(output.toAbsolutePath().toString());

      log.info("[{}] FFmpeg one-pass: {} → {} | filter={} poster={}",
              jobId, input.getFileName(), output.getFileName(), hasFilter, hasPoster);

      processExecutor.executeFfmpegCommand(cmd, new FfmpegProgressProcessor(jobId), null);
  }
  ```

- [ ] **Step 6.2 — Compile check**

  ```bash
  cd db-world-backend
  mvn compile -q
  ```

  Expected: BUILD SUCCESS.

- [ ] **Step 6.3 — Commit**

  ```bash
  git add db-world-backend/src/main/java/com/db/dbworld/app/media/enrichment/impl/TmdbMediaEnrichmentServiceImpl.java
  git commit -m "feat: per-track audio/subtitle metadata in FFmpeg pass; remove video track movie-name title"
  ```

---

## Task 7 — Fix Series Global Title Format

**Context:** Currently `metadataTitle` passed to `runFfmpegOnePass()` is just the episode name (or movie title). For TV series the global `title` metadata tag should be `{SeriesName} - Season X Episode Y – {EpisodeName}` so media players show the full context.

**Files:**
- Modify: `db-world-backend/src/main/java/com/db/dbworld/app/media/enrichment/impl/TmdbMediaEnrichmentServiceImpl.java`

- [ ] **Step 7.1 — Add `buildGlobalTitle()` helper method**

  Add this private method after `resolveOutputPath()`:

  ```java
  /**
   * Builds the global {@code title} metadata tag value.
   *
   * For movies:    "{Title}"
   * For TV series: "{SeriesName} - Season X Episode Y – {EpisodeName}"
   *                (em-dash before episode name; episode name is optional)
   */
  private String buildGlobalTitle(MediaNamingInfo info, Integer season, Integer episode) {
      if (info.seriesTitle() != null && !info.seriesTitle().isBlank()
              && season != null && episode != null) {
          StringBuilder sb = new StringBuilder(info.seriesTitle())
                  .append(" - Season ").append(season)
                  .append(" Episode ").append(episode);
          if (info.episodeName() != null && !info.episodeName().isBlank()) {
              sb.append(" \u2013 ").append(info.episodeName()); // en-dash (–)
          }
          return sb.toString();
      }
      return info.title();
  }
  ```

- [ ] **Step 7.2 — Update `doEnrich()` to pass the built title**

  Replace the `runFfmpegOnePass(...)` call in `doEnrich()` (line ~156):

  ```java
  // OLD:
  runFfmpegOnePass(inputFile, posterFile, outputFile, namingInfo.title(), namingInfo.overview(), filter, jobId);

  // NEW:
  String globalTitle = buildGlobalTitle(namingInfo, season, episode);
  runFfmpegOnePass(inputFile, posterFile, outputFile, globalTitle, namingInfo.overview(), filter, jobId);
  ```

- [ ] **Step 7.3 — Compile check**

  ```bash
  cd db-world-backend
  mvn compile -q
  ```

  Expected: BUILD SUCCESS.

- [ ] **Step 7.4 — Commit**

  ```bash
  git add db-world-backend/src/main/java/com/db/dbworld/app/media/enrichment/impl/TmdbMediaEnrichmentServiceImpl.java
  git commit -m "feat: series global title format 'SeriesName - Season X Episode Y – EpisodeName'"
  ```

---

## Task 8 — Multi/Dual Audio Label in Canonical Filename

**Context:** `buildCanonicalFileName()` in `FfmpegProcessingStrategy` uses only the primary audio track's language. The requirement is to prefix "Multi." or "Dual." when the file has 3+ or 2 audio tracks respectively.

**Files:**
- Modify: `db-world-backend/src/main/java/com/db/dbworld/app/media/ingestion/processing/strategy/FfmpegProcessingStrategy.java`

- [ ] **Step 8.1 — Add `buildAudioLanguageSegment()` helper**

  Add this private method to `FfmpegProcessingStrategy`:

  ```java
  /**
   * Builds the audio language filename segment.
   * Single track: "{Language}" (e.g., "Hindi")
   * Two tracks:   "Dual.{PrimaryLang}" (e.g., "Dual.Hindi")
   * Three+:       "Multi.{PrimaryLang}" (e.g., "Multi.Hindi")
   */
  private String buildAudioLanguageSegment(MediaFileDto mediaInfo) {
      if (mediaInfo.getTracks() == null) return null;

      java.util.List<TrackDto> audioTracks = mediaInfo.getTracks().stream()
              .filter(t -> "Audio".equals(t.getType()))
              .collect(java.util.stream.Collectors.toList());

      TrackDto primary = mediaInfo.getPrimaryAudioTrack();
      String primaryLang = normalizeLanguage(primary != null ? primary.getLanguage() : null);

      if (audioTracks.size() >= 3) {
          return primaryLang != null ? "Multi." + primaryLang : "Multi";
      } else if (audioTracks.size() == 2) {
          return primaryLang != null ? "Dual." + primaryLang : "Dual";
      } else {
          return primaryLang; // single track, no prefix
      }
  }
  ```

- [ ] **Step 8.2 — Replace `language` variable in `buildCanonicalFileName()`**

  In `buildCanonicalFileName()`, replace the `language` line (around line 305):

  ```java
  // OLD:
  String language = normalizeLanguage(audio != null ? audio.getLanguage() : null);

  // NEW:
  String language = buildAudioLanguageSegment(mediaInfo);
  ```

  (The `audio` variable is still needed by `audioCodec` and `channels` which remain unchanged.)

- [ ] **Step 8.3 — Compile check**

  ```bash
  cd db-world-backend
  mvn compile -q
  ```

  Expected: BUILD SUCCESS.

- [ ] **Step 8.4 — Commit**

  ```bash
  git add db-world-backend/src/main/java/com/db/dbworld/app/media/ingestion/processing/strategy/FfmpegProcessingStrategy.java
  git commit -m "feat: Multi./Dual. prefix in canonical filename when file has multiple audio tracks"
  ```

---

## Task 9 — Duplicate Filename Handling (Rename with Suffix)

**Context:** `moveToFinalLocation()` uses `StandardCopyOption.REPLACE_EXISTING`, silently overwriting existing files. The new behaviour: if the target exists, rename with an incrementing suffix (`.1`, `.2`, etc.) rather than overwriting.

**Files:**
- Modify: `db-world-backend/src/main/java/com/db/dbworld/app/media/ingestion/processing/strategy/FfmpegProcessingStrategy.java`

- [ ] **Step 9.1 — Add `resolveNonConflicting()` helper**

  Add this private method to `FfmpegProcessingStrategy`:

  ```java
  /**
   * Returns a path in {@code targetDir} for the given {@code fileName} that does
   * not currently exist on disk.
   *
   * If {@code fileName} is free → returns it as-is.
   * Otherwise appends ".1", ".2", … until a free slot is found (up to 99).
   */
  private Path resolveNonConflicting(Path targetDir, String fileName) {
      Path candidate = targetDir.resolve(fileName);
      if (!Files.exists(candidate)) return candidate;

      String base = stripExt(fileName);
      String ext  = extension(fileName);
      for (int suffix = 1; suffix < 100; suffix++) {
          candidate = targetDir.resolve(base + "." + suffix + "." + ext);
          if (!Files.exists(candidate)) return candidate;
      }
      // Fallback: timestamp suffix to guarantee uniqueness
      candidate = targetDir.resolve(base + "." + System.currentTimeMillis() + "." + ext);
      return candidate;
  }
  ```

- [ ] **Step 9.2 — Update `moveToFinalLocation()` to use non-conflicting path**

  Replace the `moveToFinalLocation` method:

  ```java
  private Path moveToFinalLocation(IngestionContext ctx, Path file) throws IOException {
      Path finalDir = fileStorageService.resolveFinalDir(ctx);
      Files.createDirectories(finalDir);

      Path normalizedFile     = file.toAbsolutePath().normalize();
      Path normalizedFinalDir = finalDir.toAbsolutePath().normalize();
      if (normalizedFile.getParent() != null
              && normalizedFile.getParent().equals(normalizedFinalDir)) {
          return file; // already in final dir
      }

      Path finalPath = resolveNonConflicting(finalDir, file.getFileName().toString());
      if (!finalPath.getFileName().equals(file.getFileName())) {
          ctx.log("FFMPEG", "Duplicate detected — renaming to: " + finalPath.getFileName());
      }
      ctx.log("FFMPEG", "Promoting to final: " + file.getFileName() + " → " + finalDir);
      Files.move(file, finalPath); // no REPLACE_EXISTING — path is guaranteed free
      return finalPath;
  }
  ```

- [ ] **Step 9.3 — Compile check**

  ```bash
  cd db-world-backend
  mvn compile -q
  ```

  Expected: BUILD SUCCESS.

- [ ] **Step 9.4 — Full build**

  ```bash
  cd db-world-backend
  mvn package -DskipTests -q
  ```

  Expected: BUILD SUCCESS with jar generated.

- [ ] **Step 9.5 — Commit**

  ```bash
  git add db-world-backend/src/main/java/com/db/dbworld/app/media/ingestion/processing/strategy/FfmpegProcessingStrategy.java
  git commit -m "feat: rename with suffix instead of overwrite when output file already exists"
  ```

---

## Self-Review Checklist

| Requirement | Task |
|-------------|------|
| 7z warnings not treated as errors | Task 1 |
| ZIP extraction password support | Task 1 |
| Always apply Hindi/English/Gujarati track filter | Task 3 + 4 |
| No filter if no priority language exists | Task 3 |
| Dual/Multi/One audio detection | Task 8 |
| Audio language + title per-track metadata | Task 5 + 6 |
| Hindi as default audio track | Task 5 + 6 |
| Subtitle language + title per-track metadata | Task 5 + 6 |
| Subtitle forced flag | `TrackFilter.noDefaultSubtitle` handles default; forced subtitles are a separate concern — not covered since the source file's forced flag is preserved by `-c copy` |
| Subtitle default = none | Task 5 + 6 (`noDefaultSubtitle=true`) |
| Video track title = actual metadata (not movie name) | Task 6 (removed movie-name from `-metadata:s:v:0`) |
| Series global title format | Task 7 |
| Episode cover image (already implemented in resolveNamingInfo) | — no change needed |
| Audio + language in filename | Task 8 |
| Duplicate filename handling | Task 9 |
