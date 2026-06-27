package com.db.dbworld.app.media.storyboard;

import com.db.dbworld.app.media.info.repository.MediaFileRepository;
import com.db.dbworld.config.AppProperties;
import com.db.dbworld.core.processor.ProcessExecutor;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Service;

import javax.imageio.ImageIO;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.function.Consumer;

/**
 * Generates a "storyboard" sprite sheet of thumbnail frames for scrub-bar
 * previews (the YouTube-style frame that appears when you hover/drag the
 * progress bar). One JPEG holds a grid of evenly-spaced frames; the player
 * crops the tile matching the hovered timestamp using the geometry persisted
 * on the media-file row.
 *
 * Frames are extracted with FAST input seeking ({@code -ss} before {@code -i}),
 * so each tile decodes only ~one GOP near its timestamp instead of decoding the
 * whole file — cheap enough to run ~100 times even for a 4K HEVC remux on a Pi.
 *
 * Entirely best-effort: any failure is logged and swallowed so it can never
 * break ingestion. Files ingested before this feature simply have no sprite and
 * fall back to a time-only tooltip in the player.
 */
@Log4j2
@Service
@RequiredArgsConstructor
public class StoryboardService {

    private static final int COLS              = 10;   // tiles per row
    private static final int TARGET_TILES      = 100;  // upper bound on total tiles
    private static final int MIN_INTERVAL_SEC  = 2;    // never sample closer than this
    private static final int TILE_WIDTH        = 160;  // px; height derived from source aspect

    private final AppProperties       runtime;
    private final ProcessExecutor     processExecutor;
    private final MediaFileRepository mediaFileRepository;

    /** Sprites live in a sibling dir of the symlink root: {dataRoot}/storyboards. */
    private Path storyboardDir() {
        Path symlink = runtime.getSymlinkPath();
        Path base    = symlink.getParent();
        return (base != null ? base : symlink).resolve("storyboards");
    }

    public Path spritePath(String mediaFileId) {
        return storyboardDir().resolve(mediaFileId + ".jpg");
    }

    public void generate(String mediaFileId, Path videoFile, long durationMs) {
        generate(mediaFileId, videoFile, durationMs, null);
    }

    public void generate(String mediaFileId, Path videoFile, long durationMs, Consumer<String> progress) {
        if (mediaFileId == null || videoFile == null || durationMs <= 0) {
            log.debug("Storyboard skipped (missing id/file/duration) for {}", mediaFileId);
            return;
        }

        Path tmpDir = null;
        try {
            long durationSec = durationMs / 1000;
            if (durationSec < MIN_INTERVAL_SEC) return;

            int intervalSec = Math.max(MIN_INTERVAL_SEC,
                    (int) Math.ceil(durationSec / (double) TARGET_TILES));
            int count = (int) Math.min(TARGET_TILES, durationSec / intervalSec);
            if (count < 1) return;
            int rows = (int) Math.ceil(count / (double) COLS);

            tmpDir = Files.createTempDirectory("storyboard-" + mediaFileId + "-");
            String ffmpeg = runtime.getFfmpeg();

            List<BufferedImage> tiles = new ArrayList<>(count);
            int tileH = -1;
            int lastReportedQuarter = -1;
            for (int i = 0; i < count; i++) {
                long ts   = (long) i * intervalSec;
                Path tile = tmpDir.resolve(i + ".jpg");
                try {
                    processExecutor.executeFfmpegWithSimpleOutput(List.of(
                            ffmpeg, "-y",
                            "-ss", String.valueOf(ts),
                            "-i", videoFile.toAbsolutePath().toString(),
                            "-frames:v", "1",
                            "-vf", "scale=" + TILE_WIDTH + ":-2",
                            "-q:v", "4",
                            tile.toAbsolutePath().toString()
                    ));
                    BufferedImage img = Files.exists(tile) ? ImageIO.read(tile.toFile()) : null;
                    if (img != null && tileH < 0) tileH = img.getHeight();
                    tiles.add(img); // may be null — leaves that grid cell black
                } catch (Exception e) {
                    log.debug("Storyboard tile {} failed for {}: {}", i, mediaFileId, e.getMessage());
                    tiles.add(null);
                }

                if (progress != null) {
                    int quarter = (i + 1) * 4 / count; // 0..4
                    if (quarter > lastReportedQuarter) {
                        int pct = (i + 1) * 100 / count;
                        progress.accept((i + 1) + "/" + count + " tiles (" + pct + "%)");
                        lastReportedQuarter = quarter;
                    }
                }
            }

            if (tileH < 0) {
                log.warn("Storyboard produced no usable frames for {}", mediaFileId);
                return;
            }

            // Compose the grid sprite.
            BufferedImage sprite = new BufferedImage(COLS * TILE_WIDTH, rows * tileH, BufferedImage.TYPE_INT_RGB);
            Graphics2D g = sprite.createGraphics();
            for (int i = 0; i < tiles.size(); i++) {
                BufferedImage img = tiles.get(i);
                if (img == null) continue;
                int col = i % COLS, row = i / COLS;
                g.drawImage(img, col * TILE_WIDTH, row * tileH, TILE_WIDTH, tileH, null);
            }
            g.dispose();

            Path out = spritePath(mediaFileId);
            Files.createDirectories(out.getParent());
            Files.deleteIfExists(out); // remove stale/partial file from a previous interrupted attempt
            // Write via OutputStream to avoid FileImageOutputStreamSpi issues on headless systems
            try (OutputStream os = Files.newOutputStream(out)) {
                if (!ImageIO.write(sprite, "jpg", os)) {
                    throw new IOException("No JPEG ImageWriter available (headless JPEG plugin missing)");
                }
            }

            // Persist geometry so the client can crop the right tile on hover.
            final int intervalMs = intervalSec * 1000;
            final int fRows = rows, fTileH = tileH, fCount = count;
            mediaFileRepository.findById(mediaFileId).ifPresent(e -> {
                e.setStoryboardIntervalMs(intervalMs);
                e.setStoryboardCols(COLS);
                e.setStoryboardRows(fRows);
                e.setStoryboardTileW(TILE_WIDTH);
                e.setStoryboardTileH(fTileH);
                e.setStoryboardCount(fCount);
                mediaFileRepository.save(e);
            });

            log.info("Storyboard generated for {} — {} tiles, {}x{} grid, tile {}x{}",
                    mediaFileId, count, COLS, rows, TILE_WIDTH, tileH);

        } catch (Exception e) {
            log.warn("Storyboard generation failed for {} ({}): {}",
                    mediaFileId, e.getClass().getSimpleName(), e.getMessage());
        } finally {
            if (tmpDir != null) deleteQuietly(tmpDir);
        }
    }

    private void deleteQuietly(Path dir) {
        try (var s = Files.walk(dir)) {
            s.sorted(Comparator.reverseOrder()).forEach(p -> {
                try { Files.deleteIfExists(p); } catch (IOException ignored) { /* best-effort */ }
            });
        } catch (IOException ignored) { /* best-effort */ }
    }
}
