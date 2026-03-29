package com.db.dbworld.app.media.info.controller;

import com.db.dbworld.app.cinema.catalog.entities.RecordEntity;
import com.db.dbworld.app.cinema.catalog.repository.RecordRepository;
import com.db.dbworld.app.media.info.dto.MediaFileDto;
import com.db.dbworld.app.media.info.entity.MediaFileEntity;
import com.db.dbworld.app.media.info.entity.track.AudioTrackEntity;
import com.db.dbworld.app.media.info.entity.track.GeneralTrackEntity;
import com.db.dbworld.app.media.info.entity.track.VideoTrackEntity;
import com.db.dbworld.app.media.info.repository.MediaFileRepository;
import com.db.dbworld.app.media.info.service.MediaInfoService;
import com.db.dbworld.core.exception.ResourceNotFoundException;
import com.db.dbworld.payloads.ApiResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.nio.file.Path;
import java.util.List;

/**
 * REST API for media file info (migrated from old StreamController / DbCinemaController).
 *
 * Endpoints:
 *   GET  /api/media/info/record/{recordId}         — all files for a catalog record
 *   GET  /api/media/info/{id}                      — single file by ID
 *   POST /api/media/info/scan?path=&recordId=&jobId= — scan a file and persist
 *   POST /api/media/info/{id}/rescan               — re-scan an existing entry
 *   GET  /api/media/info/raw?path=                 — raw JSON without persisting
 *   DELETE /api/media/info/path?path=              — delete by file path
 *   DELETE /api/media/info/record/{recordId}       — delete all for a record
 */
@RestController
@RequestMapping("/api/media/info")
@RequiredArgsConstructor
@Log4j2
public class MediaInfoController {

    private final MediaInfoService mediaInfoService;
    private final MediaFileRepository mediaFileRepository;
    private final RecordRepository recordRepository;

    @GetMapping("/record/{recordId}")
    public ApiResponse<List<MediaFileDto>> getByRecord(@PathVariable Long recordId) {
        return ApiResponse.success(mediaInfoService.getByRecordId(recordId));
    }

    @GetMapping("/{id}")
    public ApiResponse<MediaFileDto> getById(@PathVariable String id) {
        return mediaInfoService.getById(id)
                .map(ApiResponse::success)
                .orElse(ApiResponse.error(404, "MediaFile not found: " + id, (MediaFileDto) null));
    }

    @PostMapping("/scan")
    public ApiResponse<MediaFileDto> scan(
            @RequestParam String path,
            @RequestParam(required = false) Long recordId,
            @RequestParam(required = false) String jobId
    ) {
        MediaFileDto dto = mediaInfoService.collectAndPersist(Path.of(path), recordId, jobId);
        return ApiResponse.success("MediaInfo collected and persisted", dto);
    }

    @PostMapping("/{id}/rescan")
    public ApiResponse<MediaFileDto> rescan(@PathVariable String id) {
        MediaFileDto dto = mediaInfoService.rescan(id);
        return ApiResponse.success("Re-scanned successfully", dto);
    }

    @GetMapping("/raw")
    public ApiResponse<Void> getRaw(@RequestParam String path) {
        String json = mediaInfoService.getRawJson(Path.of(path));
        return ApiResponse.success(json);
    }

    @DeleteMapping("/path")
    public ApiResponse<Void> deleteByPath(@RequestParam String path) {
        mediaInfoService.deleteByFilePath(path);
        return ApiResponse.success("Deleted");
    }

    @DeleteMapping("/record/{recordId}")
    public ApiResponse<Void> deleteByRecord(@PathVariable Long recordId) {
        mediaInfoService.deleteByRecordId(recordId);
        return ApiResponse.success("Deleted");
    }

    /**
     * Seed realistic test media file data for a record.
     * Creates two fake MKV entries (1080p + 4K HDR) with full track metadata.
     * Idempotent — re-running replaces previous test data for this record.
     */
    @PostMapping("/seed/{recordId}")
    @Transactional
    public ApiResponse<List<MediaFileDto>> seedTestData(@PathVariable Long recordId) {
        RecordEntity record = recordRepository.findById(recordId)
                .orElseThrow(() -> new ResourceNotFoundException("Record", "id", recordId));

        String seedJobId = "test-seed-" + recordId;
        String baseName = record.getName().replaceAll("[^a-zA-Z0-9 ]", "").replaceAll(" +", ".").trim();

        // Remove previous test seed entries
        List<MediaFileEntity> existing = mediaFileRepository.findByIngestionJobId(seedJobId);
        if (!existing.isEmpty()) mediaFileRepository.deleteAll(existing);

        // ── File 1 — 1080p BluRay x264 ──────────────────────────────────────────
        MediaFileEntity f1 = new MediaFileEntity();
        f1.setRecord(record);
        f1.setFileName(baseName + ".1080p.BluRay.x264.mkv");
        f1.setFilePath("/media/movies/" + baseName + "/" + baseName + ".1080p.BluRay.x264.mkv");
        f1.setFileSize(8_589_934_592L);   // 8 GB
        f1.setMimeType("video/x-matroska");
        f1.setIngestionJobId(seedJobId);

        GeneralTrackEntity g1 = new GeneralTrackEntity();
        g1.setStreamOrder(0); g1.setFormat("Matroska"); g1.setFormatVersion("Version 4");
        g1.setFileSize(8_589_934_592L); g1.setDuration(7_200_000L);
        g1.setOverallBitRate(9_549_000L); g1.setVideoCount(1); g1.setAudioCount(2); g1.setTextCount(3);
        g1.setFileExtension("mkv"); g1.setEncodedApplication("mkvmerge v81.0");
        f1.addTrack(g1);

        VideoTrackEntity v1 = new VideoTrackEntity();
        v1.setStreamOrder(1); v1.setFormat("AVC"); v1.setCodecId("V_MPEG4/ISO/AVC");
        v1.setProfile("High@L4.1"); v1.setWidth(1920); v1.setHeight(1080);
        v1.setDisplayAspectRatio("16:9"); v1.setFrameRate("23.976"); v1.setBitRate(8_000_000L);
        v1.setBitDepth(8); v1.setColorSpace("YUV"); v1.setDuration(7_200_000L);
        v1.setDefaultTrack("Yes"); v1.setForced("No");
        f1.addTrack(v1);

        AudioTrackEntity a1 = new AudioTrackEntity();
        a1.setStreamOrder(2); a1.setFormat("AAC LC"); a1.setFormatCommercial("AAC");
        a1.setCodecId("A_AAC-2"); a1.setLanguage("eng"); a1.setTitle("English 5.1");
        a1.setChannels(6); a1.setChannelLayout("C L R Ls Rs LFE");
        a1.setSamplingRate(48000L); a1.setBitRate(384000L);
        a1.setDefaultTrack("Yes"); a1.setForced("No");
        f1.addTrack(a1);

        AudioTrackEntity a2 = new AudioTrackEntity();
        a2.setStreamOrder(3); a2.setFormat("AAC LC"); a2.setFormatCommercial("AAC");
        a2.setCodecId("A_AAC-2"); a2.setLanguage("spa"); a2.setTitle("Spanish Stereo");
        a2.setChannels(2); a2.setChannelLayout("L R");
        a2.setSamplingRate(48000L); a2.setBitRate(192000L);
        a2.setDefaultTrack("No"); a2.setForced("No");
        f1.addTrack(a2);

        // ── File 2 — 4K HDR x265 ────────────────────────────────────────────────
        MediaFileEntity f2 = new MediaFileEntity();
        f2.setRecord(record);
        f2.setFileName(baseName + ".4K.HDR.DTS-HD.x265.mkv");
        f2.setFilePath("/media/movies/" + baseName + "/" + baseName + ".4K.HDR.DTS-HD.x265.mkv");
        f2.setFileSize(42_949_672_960L);  // 40 GB
        f2.setMimeType("video/x-matroska");
        f2.setIngestionJobId(seedJobId);

        GeneralTrackEntity g2 = new GeneralTrackEntity();
        g2.setStreamOrder(0); g2.setFormat("Matroska"); g2.setFormatVersion("Version 4");
        g2.setFileSize(42_949_672_960L); g2.setDuration(7_200_000L);
        g2.setOverallBitRate(47_722_000L); g2.setVideoCount(1); g2.setAudioCount(1); g2.setTextCount(2);
        g2.setFileExtension("mkv"); g2.setEncodedApplication("mkvmerge v81.0");
        f2.addTrack(g2);

        VideoTrackEntity v2 = new VideoTrackEntity();
        v2.setStreamOrder(1); v2.setFormat("HEVC"); v2.setCodecId("V_MPEGH/ISO/HEVC");
        v2.setProfile("Main 10@L5.1@High"); v2.setWidth(3840); v2.setHeight(2160);
        v2.setDisplayAspectRatio("16:9"); v2.setFrameRate("23.976"); v2.setBitRate(40_000_000L);
        v2.setBitDepth(10); v2.setColorSpace("YUV");
        v2.setHdrFormat("SMPTE ST 2086"); v2.setHdrFormatCompatibility("HDR10");
        v2.setDuration(7_200_000L); v2.setDefaultTrack("Yes"); v2.setForced("No");
        f2.addTrack(v2);

        AudioTrackEntity a3 = new AudioTrackEntity();
        a3.setStreamOrder(2); a3.setFormat("DTS-HD Master Audio"); a3.setFormatCommercial("DTS-HD MA");
        a3.setCodecId("A_DTS"); a3.setLanguage("eng"); a3.setTitle("English DTS-HD MA 7.1");
        a3.setChannels(8); a3.setChannelLayout("C L R Ls Rs Lss Rss LFE");
        a3.setSamplingRate(48000L); a3.setBitRate(4_000_000L);
        a3.setDefaultTrack("Yes"); a3.setForced("No");
        f2.addTrack(a3);

        mediaFileRepository.saveAll(List.of(f1, f2));
        return ApiResponse.success("Test media files seeded (2 files)", mediaInfoService.getByRecordId(recordId));
    }
}
