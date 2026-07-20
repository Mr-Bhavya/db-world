package com.db.dbworld.app.media.sync;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

import java.time.Duration;

/**
 * Static (boot-time) tuning for the media reconciliation scan.
 *
 * <p>The dynamic knobs — {@code enabled} flag and scan {@code interval} — are
 * NOT here; they're stored in {@code scheduler_job_config} so the admin
 * scheduler UI can edit them at runtime. This record only carries the
 * stability window, which controls how long after a file's mtime we wait
 * before indexing it (defends against half-written files being probed by
 * ffmpeg). Tuning it requires understanding the storage stack, so a restart
 * to change it is fine.
 *
 * <pre>
 * dbworld:
 *   media-sync:
 *     stability-window: 5s
 * </pre>
 */
@ConfigurationProperties(prefix = "dbworld.media-sync")
public record MediaSyncProperties(
        @DefaultValue("5s") Duration stabilityWindow
) {}
