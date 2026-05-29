package com.db.dbworld.app.media.sync;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

import java.time.Duration;

/**
 * Configuration for the filesystem ↔ database reconciliation scan.
 *
 * <p>Bound from {@code dbworld.media-sync.*} in application.yml. Spring Boot
 * 3.0+ supports {@link DefaultValue} on record components, so the canonical
 * record constructor doubles as the binding target with sensible fallbacks.
 *
 * <p>Typical config (already in application.yml):
 * <pre>
 * dbworld:
 *   media-sync:
 *     enabled: true
 *     interval: 60s
 *     stability-window: 5s
 * </pre>
 *
 * @param enabled         master switch — set false to disable scanning entirely
 *                        (useful in dev when you don't want the Pi periodically
 *                        spinning up disk to walk the tree).
 * @param interval        delay between consecutive scans. The scheduler uses
 *                        {@code fixedDelay} semantics — the next tick starts
 *                        {@code interval} after the previous scan completes,
 *                        never overlapping.
 * @param stabilityWindow files whose mtime is newer than {@code now - stabilityWindow}
 *                        are skipped this tick. Catches files still being
 *                        written (FFmpeg one-pass, partial download, etc.) so
 *                        we don't try to probe a half-written file.
 */
@ConfigurationProperties(prefix = "dbworld.media-sync")
public record MediaSyncProperties(
        @DefaultValue("true")  boolean  enabled,
        @DefaultValue("60s")   Duration interval,
        @DefaultValue("5s")    Duration stabilityWindow
) {}
