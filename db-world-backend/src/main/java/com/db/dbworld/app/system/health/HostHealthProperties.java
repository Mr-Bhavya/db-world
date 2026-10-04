package com.db.dbworld.app.system.health;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Where the host health report lives.
 *
 * <p>A root systemd timer on the Pi runs {@code dbworldctl doctor --json} every 15 minutes and
 * writes the result here atomically (temp file + rename), root-owned and world-readable, so the
 * app's service user can read it without any extra privilege. This app only ever reads it.
 *
 * <p>Static rather than a DB setting: the path is decided by how the host is provisioned, and a
 * wrong value is not something to fix from the admin console. A dev box simply has no file, and
 * the System Info page says so.
 *
 * <pre>
 * dbworld:
 *   host-health:
 *     report-path: /var/lib/dbworld/health/doctor.json
 * </pre>
 */
@ConfigurationProperties(prefix = "dbworld.host-health")
public record HostHealthProperties(
        @DefaultValue("/var/lib/dbworld/health/doctor.json") String reportPath
) {}
