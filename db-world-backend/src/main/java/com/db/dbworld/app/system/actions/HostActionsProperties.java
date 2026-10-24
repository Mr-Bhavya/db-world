package com.db.dbworld.app.system.actions;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Where the host's action broker spools requests and results, and which clock it reads times in.
 *
 * <p>The app never runs anything privileged itself. It drops a JSON request into
 * {@code <dir>/requests/}; a root systemd path unit on the Pi hands it to {@code dbworldctl},
 * which checks it against an allowlist, runs it and writes {@code <dir>/results/<id>.json}. The
 * power state the host keeps is {@code <dir>/power.json}.
 *
 * <p>{@code zone} is the Pi's own time zone. Times an admin types ({@code 04:30},
 * {@code 2026-10-05T06:00}) mean the Pi's local time, because that is how the host reads them, so
 * the app has to resolve them in the same zone to check the wake gap and word the phone push. The
 * JVM default is not used: in a container it is usually UTC while the Pi itself runs on IST.
 *
 * <p>Static rather than DB settings, like {@code dbworld.host-health}: both are decided by how the
 * host is provisioned. A dev box has no directory, and the System Info page says so.
 *
 * <pre>
 * dbworld:
 *   host-actions:
 *     dir: /var/lib/dbworld/actions
 *     zone: Asia/Kolkata
 * </pre>
 */
@ConfigurationProperties(prefix = "dbworld.host-actions")
public record HostActionsProperties(
        @DefaultValue("/var/lib/dbworld/actions") String dir,
        @DefaultValue("Asia/Kolkata") String zone
) {}
