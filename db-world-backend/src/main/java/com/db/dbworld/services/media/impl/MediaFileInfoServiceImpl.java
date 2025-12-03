package com.db.dbworld.services.media.impl;

import com.db.dbworld.dao.dbcinema.stream.MediaFileInfoRepository;
import com.db.dbworld.entities.dbcinema.stream.*;
import com.db.dbworld.exceptions.DbWorldException;
import com.db.dbworld.exceptions.ResourceNotFoundException;
import com.db.dbworld.payloads.dbcinema.stream.*;
import com.db.dbworld.services.media.MediaFileInfoService;
import com.db.dbworld.utils.DbWorldUtils;
import jakarta.persistence.EntityManager;
import lombok.extern.log4j.Log4j2;
import org.modelmapper.ModelMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.CacheConfig;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.CollectionUtils;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.util.*;
import java.util.stream.Collectors;

@Log4j2
@Service
@Transactional
//@CacheConfig(cacheNames = "media-file")
public class MediaFileInfoServiceImpl implements MediaFileInfoService {

    private final MediaFileInfoRepository mediaFileInfoRepository;
    private final ModelMapper modelMapper;
    private final DbWorldUtils dbWorldUtils;
    private final RedisTemplate<String, Object> redisTemplate;

    @Autowired
    private EntityManager entityManager;

    @Autowired
    public MediaFileInfoServiceImpl(MediaFileInfoRepository mediaFileInfoRepository,
                                    ModelMapper modelMapper,
                                    DbWorldUtils dbWorldUtils,
                                    RedisTemplate<String, Object> redisTemplate) {
        this.mediaFileInfoRepository = mediaFileInfoRepository;
        this.modelMapper = modelMapper;
        this.dbWorldUtils = dbWorldUtils;
        this.redisTemplate = redisTemplate;
    }

    @Override
    public MediaFileInfoEntity save(MediaFileInfoEntity mediaFileInfoEntity) {
        try {
            log.debug("[DB] Saving MediaFileInfoEntity for recordId={}...",
                    mediaFileInfoEntity.getDbCinemaRecord().getId());

            // Merge each track individually
            List<TrackInfoEntity> managedTracks = new ArrayList<>();
            if (mediaFileInfoEntity.getTrackInfos() != null) {
                for (TrackInfoEntity track : mediaFileInfoEntity.getTrackInfos()) {
                    managedTracks.add(entityManager.merge(track));
                }
            }
            mediaFileInfoEntity.setTrackInfos(managedTracks);

            // Save the media file info
            MediaFileInfoEntity savedEntity = mediaFileInfoRepository.save(mediaFileInfoEntity);
            log.debug("[DB] Saved MediaFileInfoEntity with id={}", savedEntity.getId());

            clearCacheForRecord(savedEntity.getDbCinemaRecord().getId());
            return savedEntity;
        } catch (Exception ex) {
            log.error("Error saving media file info: {}", ex.getMessage(), ex);
            throw new DbWorldException("Failed to save media file information", ex);
        }
    }


    @Override
//    @Cacheable(key = "'record:' + #recordId", unless = "#result == null || #result.isEmpty()")
    public List<MediaFileInfo> getAllFileInfoByRecordId(Long recordId) {
        log.debug("[CACHE] Fetching media file info from Redis for recordId={}", recordId); // 🔍 Added Log
        try {
            log.debug("[DB] Querying all MediaFileInfoEntities for recordId={}", recordId); // 🔍 Added Log
            List<MediaFileInfoEntity> mediaFileInfoEntities = mediaFileInfoRepository.findAllByDbCinemaRecordId(recordId);
            log.debug("[DB] Retrieved {} file info records from DB", mediaFileInfoEntities.size()); // 🔍 Added Log

            return mediaFileInfoEntities.stream()
                    .map(this::mapToMediaFileInfoDto)
                    .collect(Collectors.toList());
        } catch (Exception ex) {
            log.error("Error retrieving media files for record {}: {}", recordId, ex.getMessage());
            throw new DbWorldException("Failed to retrieve media files", ex.getMessage());
        }
    }


    private MediaFileInfo mapToMediaFileInfoDto(MediaFileInfoEntity entity) {
        try {
            MediaFileInfo dto = modelMapper.map(entity, MediaFileInfo.class);

            // Safely handle trackInfos conversion
            if (entity.getTrackInfos() != null) {
                dto.setTrackInfos(entity.getTrackInfos().stream()
                        .map(this::mapToTrackInfoDto)
                        .collect(Collectors.toList()));
            } else {
                dto.setTrackInfos(Collections.emptyList());
            }

            return dto;
        } catch (Exception e) {
            log.error("Mapping error for MediaFileInfoEntity ID: {}", entity.getId(), e);
            throw new DbWorldException("Mapping error", e.getMessage());
        }
    }

    private TrackInfo mapToTrackInfoDto(TrackInfoEntity entity) {
        try {
            if (entity == null) {
                return null;
            }

            if (entity instanceof GeneralInfoEntity) {
                return modelMapper.map(entity, GeneralInfo.class);
            } else if (entity instanceof VideoInfoEntity) {
                return modelMapper.map(entity, VideoInfo.class);
            } else if (entity instanceof AudioInfoEntity) {
                return modelMapper.map(entity, AudioInfo.class);
            } else if (entity instanceof TextInfoEntity) {
                return modelMapper.map(entity, TextInfo.class);
            } else if (entity instanceof MenuInfoEntity) {
                return modelMapper.map(entity, MenuInfo.class);
            }
            return modelMapper.map(entity, TrackInfo.class);
        } catch (Exception e) {
            log.error("Mapping error for TrackInfoEntity ID: {}", entity.getId(), e);
            throw new DbWorldException("Track info mapping error", e.getMessage());
        }
    }

    @Override
//    @Cacheable(key = "'file:' + #id")
    public String getFileInfoById(String id) {
        log.debug("[CACHE] Fetching file info from Redis for fileId={}", id); // 🔍 Added Log
        try {
            log.debug("[DB] Looking up file info in DB for fileId={}", id); // 🔍 Added Log
            return mediaFileInfoRepository.getFileInfoById(id)
                    .orElseThrow(() -> new ResourceNotFoundException("MediaFileInfo", "id", id));
        } catch (ResourceNotFoundException ex) {
            throw ex;
        } catch (Exception ex) {
            log.error("Error retrieving file info for ID {}: {}", id, ex.getMessage());
            throw new DbWorldException("Failed to retrieve file information", ex);
        }
    }

    @Override
//    @Cacheable("filePaths")
    public List<Map<String, Object>> getAllFilePath() {
        log.debug("[CACHE] Fetching all file paths from Redis (or DB fallback)"); // 🔍 Added Log
        try {
            log.debug("[DB] Querying all file paths from MediaFileInfoRepository"); // 🔍 Added Log
            return mediaFileInfoRepository.getAllFilePath();
        } catch (Exception ex) {
            log.error("Error retrieving all file paths: {}", ex.getMessage());
            throw new DbWorldException("Failed to retrieve file paths", ex);
        }
    }

    @Override
//    @CacheEvict(key = "'file:' + #id")
    public void deleteInfoById(String id) {
        try {
            log.debug("[DB] Looking up MediaFileInfoEntity for deletion with id={}", id); // 🔍 Added Log
            MediaFileInfoEntity mediaFileInfo = mediaFileInfoRepository.findById(id)
                    .orElseThrow(() -> new ResourceNotFoundException("MediaFileInfo", "id", id));

            clearCacheForRecord(mediaFileInfo.getDbCinemaRecord().getId());

            log.debug("[DB] Deleting MediaFileInfoEntity with id={}", id); // 🔍 Added Log
            mediaFileInfoRepository.delete(mediaFileInfo);

            dbWorldUtils.deleteFileOrDirectory(mediaFileInfo.getFilePath(), false);
            log.debug("[FS] Deleted file from disk: {}", mediaFileInfo.getFilePath()); // 🔍 Added Log
        } catch (Exception ex) {
            log.error("Error deleting media file with ID {}: {}", id, ex.getMessage());
            throw new DbWorldException("Failed to delete media file", ex);
        }
    }

    @Override
    public void deleteInfoByIds(List<String> ids) {
        try {
            log.debug("[DB] Fetching MediaFileInfoEntities for deletion (ids={})", ids); // 🔍 Added Log
            List<MediaFileInfoEntity> mediaFileInfos = mediaFileInfoRepository.findAllById(ids);

            mediaFileInfos.stream()
                    .map(mfi -> mfi.getDbCinemaRecord().getId())
                    .distinct()
                    .forEach(this::clearCacheForRecord);

            log.debug("[DB] Deleting {} media file entries from DB", mediaFileInfos.size()); // 🔍 Added Log
            mediaFileInfoRepository.deleteAll(mediaFileInfos);

            mediaFileInfos.forEach(mfi -> {
                dbWorldUtils.deleteFileOrDirectory(mfi.getFilePath(), false);
                log.debug("[FS] Deleted file: {}", mfi.getFilePath()); // 🔍 Added Log
            });
        } catch (Exception ex) {
            log.error("Error deleting media files with IDs {}: {}", ids, ex.getMessage());
            throw new DbWorldException("Failed to delete media files", ex);
        }
    }

    private void clearCacheForRecord(Long recordId) {
        String cacheKey = "media-file::record:" + recordId;
        log.debug("[CACHE] Evicting Redis cache for key={}", cacheKey); // 🔍 Added Log
        redisTemplate.delete(cacheKey);
    }

    @Override
    public void deleteInfoByFilePath(String filePath) {
        try {
            log.debug("[DB] Fetching MediaFileInfoEntities by filePath={}", filePath); // 🔍 Added Log
            List<MediaFileInfoEntity> mediaFileInfoEntities = mediaFileInfoRepository.findAllByFilePath(filePath);

            if (!CollectionUtils.isEmpty(mediaFileInfoEntities)) {
                mediaFileInfoEntities.stream()
                        .map(mfi -> mfi.getDbCinemaRecord().getId())
                        .distinct()
                        .forEach(this::clearCacheForRecord);

                log.debug("[DB] Deleting {} entries with filePath={}", mediaFileInfoEntities.size(), filePath); // 🔍 Added Log
                mediaFileInfoRepository.deleteAll(mediaFileInfoEntities);
            }
        } catch (Exception ex) {
            log.error("Error deleting media files with path {}: {}", filePath, ex.getMessage());
            throw new DbWorldException("Failed to delete media files by path", ex);
        }
    }

    @Override
//    @CacheEvict(value = {"filePaths"}, allEntries = true)
    public Map<String, Integer> cleanMediaFileInfo() {
        log.info("[TASK] Starting media file cleanup...");

        List<Map<String, Object>> filePaths = getAllFilePath();
        Map<String, Integer> result = new HashMap<>();

        if (CollectionUtils.isEmpty(filePaths)) {
            log.warn("[TASK] No media file paths found in the database.");
            result.put("totalCount", 0);
            result.put("deletedFilesCount", 0);
            return result;
        }

        log.info("[TASK] Loaded {} media file paths from DB", filePaths.size());

        Map<Boolean, List<String>> partitionedIds = filePaths.stream()
                .filter(this::isValidFileInfo)
                .filter(this::shouldDeleteFile)
                .collect(Collectors.partitioningBy(this::isFileSizeMismatch,
                        Collectors.mapping(fileInfo -> String.valueOf(fileInfo.get("id")),
                                Collectors.toList())
                ));

        List<String> idsToDelete = partitionedIds.values().stream()
                .flatMap(List::stream)
                .collect(Collectors.toList());

        if (!idsToDelete.isEmpty()) {
            log.debug("[TASK] Deleting {} invalid entries...", idsToDelete.size()); // 🔍 Added Log
            deleteInfoByIds(idsToDelete);
            log.info("[TASK] Deleted {} media file entries ({} size mismatches, {} missing files).",
                    idsToDelete.size(),
                    partitionedIds.get(true).size(),
                    partitionedIds.get(false).size());
        } else {
            log.info("[TASK] No invalid media files found to delete.");
        }

        result.put("totalCount", filePaths.size());
        result.put("deletedFilesCount", idsToDelete.size());
        result.put("sizeMismatchCount", partitionedIds.get(true).size());
        result.put("missingFileCount", partitionedIds.get(false).size());

        log.info("[TASK] Media file cleanup completed.");
        return result;
    }

    private boolean isValidFileInfo(Map<String, Object> fileInfo) {
        boolean valid = fileInfo.containsKey("filePath") && fileInfo.containsKey("id") && fileInfo.containsKey("fileSize");
        if (!valid) {
            log.warn("Invalid file info encountered: {}", fileInfo);
        }
        return valid;
    }

    private boolean shouldDeleteFile(Map<String, Object> fileInfo) {
        String filePath = String.valueOf(fileInfo.get("filePath"));
        File file = new File(filePath);
        return !file.exists() || isFileSizeMismatch(fileInfo);
    }

    private boolean isFileSizeMismatch(Map<String, Object> fileInfo) {
        File file = null;
        try {
            String filePath = String.valueOf(fileInfo.get("filePath"));
            file = new File(filePath);
            if (!file.exists()) return false;

            long actualFileSize = Files.size(file.toPath());
            return actualFileSize != Long.parseLong(String.valueOf(fileInfo.get("fileSize")));
        } catch (IOException e) {
            log.error("Error checking file size for {}: {}", file.getPath(), e.getMessage());
            return false;
        }
    }
}