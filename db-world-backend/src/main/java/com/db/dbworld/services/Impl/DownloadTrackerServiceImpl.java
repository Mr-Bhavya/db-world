package com.db.dbworld.services.Impl;

import com.db.dbworld.dao.user.UserCinemaDataRepository;
import com.db.dbworld.entities.user.UserCinemaDataEntity;
import com.db.dbworld.services.UserService;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.TimeUnit;

@Log4j2
@Service
public class DownloadTrackerServiceImpl {

    @Autowired
    private RedisTemplate<String, DownloadStatus> redisTemplate;

    @Autowired
    private UserCinemaDataRepository userCinemaDataRepository;

    @Autowired
    private UserService userService;

    // Helper method to update Redis with a defined TTL.
    private void updateRedis(String key, DownloadStatus status) {
        redisTemplate.opsForValue().set(key, status, 1, TimeUnit.DAYS);
    }

    /**
     * Starts or resumes a download session.
     * NOTE: No DB persistence is done here.
     */
    public void startOrResumeDownload(String downloadId, String fileName, String userId, long fileSize, long rangeStart) {
        String key = "download:" + downloadId;
        DownloadStatus status = redisTemplate.opsForValue().get(key);
        if (status == null) {
            status = new DownloadStatus(downloadId, fileName, userId, fileSize);
            if (rangeStart > 0) {
                status.addDownloadedRange(new ByteRange(0, rangeStart - 1));
            }
            updateRedis(key, status);
            log.info("Download session started: {}", status);
        } else {
            if (status.isPaused() || status.isFailed()) {
                status.setPaused(false);
                status.setFailed(false);
                updateRedis(key, status);
                log.info("Download resumed: {}", status);
            }
        }
    }

    /**
     * Merges new downloaded range and updates Redis.
     */
    public void updateDownloadedRange(String downloadId, long newRangeStart, long newRangeEnd) {
        String key = "download:" + downloadId;
        DownloadStatus status = redisTemplate.opsForValue().get(key);
        if (status != null) {
            synchronized (status) {
                status.addDownloadedRange(new ByteRange(newRangeStart, newRangeEnd));
                log.debug("Download {} updated with range {}-{}. Unique bytes downloaded: {}",
                        downloadId, newRangeStart, newRangeEnd, status.getUniqueBytesDownloaded());
                updateRedis(key, status);
            }
        }
    }

    /**
     * Marks the download as paused.
     */
    public void pauseDownload(String downloadId) {
        String key = "download:" + downloadId;
        DownloadStatus status = redisTemplate.opsForValue().get(key);
        if (status != null) {
            status.setPaused(true);
            updateRedis(key, status);
            log.info("Download {} paused at {} unique bytes.", downloadId, status.getUniqueBytesDownloaded());
        }
    }

    /**
     * Marks the download as failed.
     */
    public void failDownload(String downloadId, String error) {
        String key = "download:" + downloadId;
        DownloadStatus status = redisTemplate.opsForValue().get(key);
        if (status != null) {
            status.setFailed(true);
            status.setError(error);
            updateRedis(key, status);
            log.error("Download {} failed: {}", downloadId, error);
        }
    }

    /**
     * Marks the download as complete. This method persists the completion event to the DB
     * and then removes the Redis session.
     */
    public void completeDownload(String downloadId) {
        String key = "download:" + downloadId;
        DownloadStatus status = redisTemplate.opsForValue().get(key);
        if (status != null && !status.isCompleted()) {
            status.setCompleted(true);
            updateRedis(key, status);
            log.info("Download {} complete: {} bytes downloaded.", downloadId, status.getUniqueBytesDownloaded());
            // Persist the download completion event in the database.
            UserCinemaDataEntity userCinemaDataEntity = new UserCinemaDataEntity();
            userCinemaDataEntity.setEvent("DOWNLOAD");
            userCinemaDataEntity.setUser(userService.getUserEntityByEmail(status.getUserId()));
            userCinemaDataEntity.setValue(status.getFileName());
            userCinemaDataRepository.save(userCinemaDataEntity);
            // Remove the session from Redis.
//            redisTemplate.delete(key);
        }
    }

    public DownloadStatus getDownloadStatus(String downloadId) {
        String key = "download:" + downloadId;
        return redisTemplate.opsForValue().get(key);
    }

    public List<DownloadStatus> getAllDownloadStatus() {
        Set<String> keys = redisTemplate.keys("download:*");
        if (keys == null || keys.isEmpty()) {
            return new ArrayList<>();
        }
        return new ArrayList<>(Objects.requireNonNull(redisTemplate.opsForValue().multiGet(keys)));
    }

    @Getter
    @Setter
    @NoArgsConstructor
    public static class DownloadStatus {
        private String downloadId;
        private String fileName;
        private String userId;
        private long fileSize;
        private final List<ByteRange> downloadedRanges = new ArrayList<>();
        private long uniqueBytesDownloaded = 0;
        private boolean completed;
        private boolean paused;
        private boolean failed;
        private String error;

        public DownloadStatus(String downloadId, String fileName, String userId, long fileSize) {
            this.downloadId = downloadId;
            this.fileName = fileName;
            this.userId = userId;
            this.fileSize = fileSize;
        }

        /**
         * Adds a new byte range, merges overlapping/contiguous ranges,
         * and recalculates the total unique bytes downloaded.
         */
        public synchronized void addDownloadedRange(ByteRange newRange) {
            downloadedRanges.add(newRange);
            downloadedRanges.sort(Comparator.comparingLong(r -> r.start));
            List<ByteRange> merged = new ArrayList<>();
            ByteRange current = null;
            for (ByteRange r : downloadedRanges) {
                if (current == null) {
                    current = new ByteRange(r.start, r.end);
                } else {
                    if (r.start <= current.end + 1) {
                        current.end = Math.max(current.end, r.end);
                    } else {
                        merged.add(current);
                        current = new ByteRange(r.start, r.end);
                    }
                }
            }
            if (current != null) {
                merged.add(current);
            }
            downloadedRanges.clear();
            downloadedRanges.addAll(merged);
            uniqueBytesDownloaded = 0;
            for (ByteRange r : merged) {
                uniqueBytesDownloaded += (r.end - r.start + 1);
            }
        }
    }

    @NoArgsConstructor
    public static class ByteRange {
        public long start;
        public long end;

        public ByteRange(long start, long end) {
            this.start = start;
            this.end = end;
        }

        @Override
        public String toString() {
            return "[" + start + "," + end + "]";
        }
    }
}