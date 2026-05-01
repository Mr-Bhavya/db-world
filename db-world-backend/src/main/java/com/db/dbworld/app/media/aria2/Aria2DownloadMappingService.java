package com.db.dbworld.app.media.aria2;

import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Service;

import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Thread-safe bidirectional GID ↔ MirrorId/JobId mapping.
 *
 * Bug fix over the old version (services.aria2.Aria2DownloadMappingService):
 *   getGidByMirrorId() was O(n) — streamed the entire forward-map on every call.
 *   This version maintains a reverse index (mirrorId → gid) so both
 *   lookups are O(1) regardless of the number of active downloads.
 */
@Log4j2
@Service("appAria2DownloadMappingService")
public class Aria2DownloadMappingService {

    /** gid → mirrorId/jobId */
    private final ConcurrentHashMap<String, String> gidToJobId  = new ConcurrentHashMap<>();
    /** mirrorId/jobId → gid  (reverse index — O(1) reverse lookup) */
    private final ConcurrentHashMap<String, String> jobIdToGid  = new ConcurrentHashMap<>();
    /** gid → last status update timestamp */
    private final ConcurrentHashMap<String, Long>   lastUpdate  = new ConcurrentHashMap<>();

    // ──────────────────────────────────────────────────────────────────────────

    public void addMapping(String jobId, String gid) {
        if (gid == null || gid.isBlank() || jobId == null || jobId.isBlank()) {
            log.warn("Cannot add mapping: blank GID or jobId");
            return;
        }

        // If this jobId already has a GID, remove the stale forward entry
        String oldGid = jobIdToGid.get(jobId);
        if (oldGid != null && !oldGid.equals(gid)) {
            log.warn("JobId {} re-mapped from GID {} to {}", jobId, oldGid, gid);
            gidToJobId.remove(oldGid);
            lastUpdate.remove(oldGid);
        }

        // If this GID already maps to a different jobId, warn and replace
        String oldJobId = gidToJobId.get(gid);
        if (oldJobId != null && !oldJobId.equals(jobId)) {
            log.warn("GID {} re-mapped from jobId {} to {}", gid, oldJobId, jobId);
            jobIdToGid.remove(oldJobId);
        }

        gidToJobId.put(gid, jobId);
        jobIdToGid.put(jobId, gid);
        lastUpdate.put(gid, System.currentTimeMillis());
        log.debug("Mapped GID {} ↔ jobId {}", gid, jobId);
    }

    public void removeByGid(String gid) {
        if (gid == null) return;
        String jobId = gidToJobId.remove(gid);
        lastUpdate.remove(gid);
        if (jobId != null) {
            jobIdToGid.remove(jobId);
            log.debug("Removed mapping GID {} ↔ jobId {}", gid, jobId);
        }
    }

    public void removeByJobId(String jobId) {
        if (jobId == null) return;
        String gid = jobIdToGid.remove(jobId);
        if (gid != null) {
            gidToJobId.remove(gid);
            lastUpdate.remove(gid);
            log.debug("Removed mapping jobId {} ↔ GID {}", jobId, gid);
        }
    }

    /** O(1) */
    public String getJobIdByGid(String gid) {
        return gidToJobId.get(gid);
    }

    /** O(1) — was O(n) in the old implementation */
    public String getGidByJobId(String jobId) {
        return jobIdToGid.get(jobId);
    }

    public boolean isGidActive(String gid) {
        return gidToJobId.containsKey(gid);
    }

    public void touchGid(String gid) {
        if (gid != null && gidToJobId.containsKey(gid)) {
            lastUpdate.put(gid, System.currentTimeMillis());
        }
    }

    public Long getLastUpdateTime(String gid) {
        return lastUpdate.get(gid);
    }

    public int activeCount() {
        return gidToJobId.size();
    }

    public Set<String> activeGids() {
        return new HashSet<>(gidToJobId.keySet());
    }

    public Map<String, String> snapshotGidToJobId() {
        return new ConcurrentHashMap<>(gidToJobId);
    }
}
