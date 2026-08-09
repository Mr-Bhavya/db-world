package com.db.dbworld.app.media.ingestion.model;

import com.db.dbworld.app.media.enrichment.TrackFilter;
import lombok.Data;

/**
 * Partial edit applied to a still-running job via {@code PATCH /api/ingestion/{jobId}/params}.
 * Every field is nullable — only non-null fields are applied; the rest are left unchanged.
 *
 * <p>Fields fall into two tiers by <em>when the pipeline consumes them</em>, which the controller
 * enforces against the job's live status:
 * <ul>
 *   <li><b>Processing-tier</b> (recordId, season, episode, extract/extractPassword, rename/fileName,
 *       trackFilter) — consumed at PROCESSING, so editable while the job is QUEUED / STARTED /
 *       DOWNLOADING / PAUSED (i.e. until the download finishes and processing begins).</li>
 *   <li><b>Download-tier</b> (uri, video/audio itag, videoQuality, onlyAudio, folderName, url auth) —
 *       consumed at DOWNLOAD, so editable only while the job is still QUEUED (before the download
 *       starts).</li>
 * </ul>
 */
@Data
public class JobEditRequest {

    // ── Processing-tier (editable until the download finishes) ──────────────────
    /** Link (or re-link) the job to a cinema record — fixes a missing/wrong record. */
    private Long recordId;
    /** TV season number (only meaningful when the linked record is a TV series). */
    private Integer season;
    /** TV episode number within the season. */
    private Integer episode;
    /** Extract the download afterwards (archives). */
    private Boolean extract;
    /** Password for an encrypted archive (write-only; never echoed back). */
    private String extractPassword;
    /** Rename the output to {@link #fileName}. */
    private Boolean rename;
    /** Custom output filename (used when {@link #rename} is true). */
    private String fileName;
    /** FFmpeg track filter (audio-language / subtitle selection) applied during enrichment. */
    private TrackFilter trackFilter;

    // ── Download-tier (editable only while still QUEUED) ────────────────────────
    /** Source URL. */
    private String uri;
    private String videoITag;
    private String audioITag;
    /** Quality preset: best / 2160 / 1080 / 720 / 480 / audio. */
    private String videoQuality;
    private Boolean onlyAudio;
    /** Target sub-folder for the download. */
    private String folderName;
    private Boolean urlProtected;
    private String username;
    /** Password for a protected source URL (write-only; never echoed back). */
    private String password;
}
