package com.db.dbworld.services.aria2;

import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Service;

import java.util.HashSet;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Log4j2
@Service
public class Aria2DownloadMappingService {
    private final Map<String, String> activeDownloads = new ConcurrentHashMap<>();
    private final Map<String, Long> lastStatusUpdate = new ConcurrentHashMap<>();

    public void addMappingToActiveDownloads(String mirrorId, String gid) {
        if (gid == null || gid.trim().isEmpty() || mirrorId == null || mirrorId.trim().isEmpty()) {
            log.warn("Cannot add mapping: Invalid GID or MirrorId");
            return;
        }

        // Check if GID is already mapped to a different mirror
        String existingMirrorId = activeDownloads.get(gid);
        if (existingMirrorId != null && !existingMirrorId.equals(mirrorId)) {
            log.warn("GID {} already mapped to mirrorId: {}, cannot map to new mirrorId: {}",
                    gid, existingMirrorId, mirrorId);
            return;
        }

        // Check if mirror is already mapped to a different GID
        Optional<String> existingGid = activeDownloads.entrySet().stream()
                .filter(entry -> entry.getValue().equals(mirrorId))
                .map(Map.Entry::getKey)
                .findFirst();

        if (existingGid.isPresent() && !existingGid.get().equals(gid)) {
            log.warn("MirrorId {} already mapped to GID: {}, replacing with new GID: {}",
                    mirrorId, existingGid.get(), gid);
            activeDownloads.remove(existingGid.get());
            lastStatusUpdate.remove(existingGid.get());
        }

        // Add the mapping
        activeDownloads.put(gid, mirrorId);
        lastStatusUpdate.put(gid, System.currentTimeMillis());
        log.info("Added active download mapping - GID: {} → MirrorId: {}", gid, mirrorId);
    }

    public void removeMapping(String gid) {
        if (gid == null) return;

        String mirrorId = activeDownloads.remove(gid);
        lastStatusUpdate.remove(gid);
        if (mirrorId != null) {
            log.info("Removed active download mapping - GID: {} → MirrorId: {}", gid, mirrorId);
        }
    }

    public void updateLastStatusTime(String gid) {
        if (gid != null && activeDownloads.containsKey(gid)) {
            lastStatusUpdate.put(gid, System.currentTimeMillis());
        }
    }

    public String getMirrorIdByGid(String gid) {
        return activeDownloads.get(gid);
    }

    public String getGidByMirrorId(String mirrorId) {
        return activeDownloads.entrySet().stream()
                .filter(entry -> entry.getValue().equals(mirrorId))
                .map(Map.Entry::getKey)
                .findFirst()
                .orElse(null);
    }

    public boolean isGidActive(String gid) {
        return activeDownloads.containsKey(gid);
    }

    public Map<String, String> getActiveDownloads() {
        return new ConcurrentHashMap<>(activeDownloads);
    }

    public Map<String, Long> getLastStatusUpdates() {
        return new ConcurrentHashMap<>(lastStatusUpdate);
    }

    public Long getLastStatusUpdate(String gid) {
        return lastStatusUpdate.get(gid);
    }

    public Set<String> getActiveGids() {
        return new HashSet<>(activeDownloads.keySet());
    }

    public int getActiveDownloadsCount() {
        return activeDownloads.size();
    }
}