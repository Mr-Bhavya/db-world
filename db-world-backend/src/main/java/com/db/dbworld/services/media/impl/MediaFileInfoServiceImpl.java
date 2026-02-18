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
public class MediaFileInfoServiceImpl implements MediaFileInfoService {

    private final MediaFileInfoRepository mediaFileInfoRepository;
    private final ModelMapper modelMapper;
    private final DbWorldUtils dbWorldUtils;
    private final RedisTemplate<String, Object> redisTemplate;

    @Autowired private EntityManager entityManager;

    @Autowired
    public MediaFileInfoServiceImpl(MediaFileInfoRepository mediaFileInfoRepository, ModelMapper modelMapper, DbWorldUtils dbWorldUtils, RedisTemplate<String, Object> redisTemplate) {
        this.mediaFileInfoRepository = mediaFileInfoRepository;
        this.modelMapper = modelMapper;
        this.dbWorldUtils = dbWorldUtils;
        this.redisTemplate = redisTemplate;
    }

    @Override
    public MediaFileInfoEntity save(MediaFileInfoEntity entity) {
        try {
            List<TrackInfoEntity> managedTracks = new ArrayList<>();
            if (entity.getTrackInfos() != null) for (TrackInfoEntity track : entity.getTrackInfos()) managedTracks.add(entityManager.merge(track));
            entity.setTrackInfos(managedTracks);
            MediaFileInfoEntity saved = mediaFileInfoRepository.save(entity);
            updateRedisCaches(saved);
            return saved;
        } catch (Exception e) {
            log.error("Failed to save MediaFileInfoEntity id={}", entity != null ? entity.getId() : null, e);
            throw new DbWorldException("Failed to save media file info", e);
        }
    }

    @Override
    public List<MediaFileInfo> findAll() {
        try {
            return mediaFileInfoRepository.findAll().stream().map(this::mapToMediaFileInfoDto).collect(Collectors.toList());
        } catch (Exception e) {
            log.error("Failed to fetch all MediaFileInfoEntity", e);
            throw new DbWorldException("Failed to find all media file info", e);
        }
    }

    @Override
    public Optional<MediaFileInfo> findById(String id) {
        try {
            return mediaFileInfoRepository.findById(id).map(this::mapToMediaFileInfoDto);
        } catch (Exception e) {
            log.error("Failed to fetch MediaFileInfoEntity id={}", id, e);
            throw new DbWorldException("Failed to find media file info by id", e);
        }
    }

    @Override
    public List<MediaFileInfoEntity> findAllEntities() {
        try {
            return mediaFileInfoRepository.findAll();
        } catch (Exception e) {
            log.error("Failed to fetch all MediaFileInfoEntity", e);
            throw new DbWorldException("Failed to find all media file info", e);
        }
    }

    @Override
    public Optional<MediaFileInfoEntity> findEntityById(String id) {
        try {
            return mediaFileInfoRepository.findById(id);
        } catch (Exception e) {
            log.error("Failed to fetch MediaFileInfoEntity id={}", id, e);
            throw new DbWorldException("Failed to find media file info by id", e);
        }
    }

    @Override
    public List<MediaFileInfo> getAllFileInfoByRecordId(Long recordId) {
        try {
            String cacheKey = "media-file::record:" + recordId;
            Object cached = redisTemplate.opsForValue().get(cacheKey);
            if (cached instanceof List<?>) return (List<MediaFileInfo>) cached;
            List<MediaFileInfo> result = mediaFileInfoRepository.findAllByDbCinemaRecordId(recordId).stream().map(this::mapToMediaFileInfoDto).collect(Collectors.toList());
            redisTemplate.opsForValue().set(cacheKey, result);
            return result;
        } catch (Exception e) {
            log.error("Failed to fetch MediaFileInfo by recordId={}", recordId, e);
            throw new DbWorldException("Failed to get media file info by record", e);
        }
    }

    @Override
    public List<MediaFileInfoEntity> getAllFileInfoEntityByRecordId(Long recordId) {
        try {
            return mediaFileInfoRepository.findAllByDbCinemaRecordId(recordId);
        } catch (Exception e) {
            log.error("Failed to fetch MediaFileInfo by recordId={}", recordId, e);
            throw new DbWorldException("Failed to get media file info by record", e);
        }
    }

    @Override
    public Optional<MediaFileInfoEntity> findOneByFilePath(String path) {
        try {
            return mediaFileInfoRepository.findOneByFilePath(path);
        } catch (Exception e) {
            log.error("Failed to fetch MediaFileInfo by Path={}", path, e);
            throw new DbWorldException("Failed to get media file info by path", e);
        }
    }

    @Override
    public String getFileInfoById(String id) {
        try {
            String cacheKey = "media-file::file:" + id;
            Object cached = redisTemplate.opsForValue().get(cacheKey);
            if (cached instanceof String) return (String) cached;
            String value = mediaFileInfoRepository.getFileInfoById(id).orElseThrow(() -> new ResourceNotFoundException("MediaFileInfo", "id", id));
            redisTemplate.opsForValue().set(cacheKey, value);
            return value;
        } catch (Exception e) {
            log.error("Failed to get file info id={}", id, e);
            throw e instanceof RuntimeException ? (RuntimeException) e : new DbWorldException("Failed to get media file info", e);
        }
    }

    @Override
    public List<Map<String, Object>> getAllFilePath() {
        try {
            String cacheKey = "media-file::paths";
            Object cached = redisTemplate.opsForValue().get(cacheKey);
            if (cached instanceof List<?>) return (List<Map<String, Object>>) cached;
            List<Map<String, Object>> list = mediaFileInfoRepository.getAllFilePath();
            redisTemplate.opsForValue().set(cacheKey, list);
            return list;
        } catch (Exception e) {
            log.error("Failed to fetch all media file paths", e);
            throw new DbWorldException("Failed to fetch media file paths", e);
        }
    }

    @Override
    public void deleteInfoById(String id) {
        try {
            MediaFileInfoEntity entity = mediaFileInfoRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("MediaFileInfo", "id", id));
            mediaFileInfoRepository.delete(entity);
            dbWorldUtils.deleteFileOrDirectory(entity.getFilePath(), false);
            evictRedisCaches(entity);
        } catch (Exception e) {
            log.error("Failed to delete MediaFileInfoEntity id={}", id, e);
            throw e instanceof RuntimeException ? (RuntimeException) e : new DbWorldException("Failed to delete media file info", e);
        }
    }

    @Override
    public void deleteInfoByIds(List<String> ids) {
        try {
            List<MediaFileInfoEntity> entities = mediaFileInfoRepository.findAllById(ids);
            mediaFileInfoRepository.deleteAll(entities);
            for (MediaFileInfoEntity e : entities) {
                dbWorldUtils.deleteFileOrDirectory(e.getFilePath(), false);
                evictRedisCaches(e);
            }
        } catch (Exception e) {
            log.error("Failed to delete MediaFileInfoEntities ids={}", ids, e);
            throw new DbWorldException("Failed to delete media file infos", e);
        }
    }

    @Override
    public void deleteInfoByFilePath(String filePath) {
        try {
            List<MediaFileInfoEntity> list = mediaFileInfoRepository.findAllByFilePath(filePath);
            if (CollectionUtils.isEmpty(list)) return;
            mediaFileInfoRepository.deleteAll(list);
            for (MediaFileInfoEntity e : list) {
                evictRedisCaches(e);
            }
        } catch (Exception e) {
            log.error("Failed to delete MediaFileInfo by filePath={}", filePath, e);
            throw new DbWorldException("Failed to delete media file info by file path", e);
        }
    }

    @Override
    public Map<String, Integer> cleanMediaFileInfo() {
        try {
            List<Map<String, Object>> filePaths = getAllFilePath();
            List<String> idsToDelete = filePaths.stream().filter(this::isValidFileInfo).filter(this::shouldDeleteFile).map(m -> String.valueOf(m.get("id"))).collect(Collectors.toList());
            if (!idsToDelete.isEmpty()) deleteInfoByIds(idsToDelete);
            Map<String, Integer> result = new HashMap<>();
            result.put("totalCount", filePaths.size());
            result.put("deletedFilesCount", idsToDelete.size());
            return result;
        } catch (Exception e) {
            log.error("Failed to cleanup media file info", e);
            throw new DbWorldException("Failed to cleanup media file info", e);
        }
    }

    private void updateRedisCaches(MediaFileInfoEntity entity) {
        try {
            redisTemplate.delete("media-file::record:" + entity.getDbCinemaRecord().getId());
            redisTemplate.delete("media-file::file:" + entity.getId());
            redisTemplate.delete("media-file::paths");
        } catch (Exception e) {
            log.warn("Failed to update redis cache for mediaFileId={}", entity.getId(), e);
        }
    }

    private void evictRedisCaches(MediaFileInfoEntity entity) {
        try {
            redisTemplate.delete("media-file::record:" + entity.getDbCinemaRecord().getId());
            redisTemplate.delete("media-file::file:" + entity.getId());
            redisTemplate.delete("media-file::paths");
        } catch (Exception e) {
            log.warn("Failed to evict redis cache for mediaFileId={}", entity.getId(), e);
        }
    }

    private MediaFileInfo mapToMediaFileInfoDto(MediaFileInfoEntity entity) {
        MediaFileInfo dto = modelMapper.map(entity, MediaFileInfo.class);
        if (entity.getTrackInfos() != null) dto.setTrackInfos(entity.getTrackInfos().stream().map(this::mapToTrackInfoDto).collect(Collectors.toList()));
        else dto.setTrackInfos(Collections.emptyList());
        return dto;
    }

    private TrackInfo mapToTrackInfoDto(TrackInfoEntity entity) {
        if (entity instanceof GeneralInfoEntity) return modelMapper.map(entity, GeneralInfo.class);
        if (entity instanceof VideoInfoEntity) return modelMapper.map(entity, VideoInfo.class);
        if (entity instanceof AudioInfoEntity) return modelMapper.map(entity, AudioInfo.class);
        if (entity instanceof TextInfoEntity) return modelMapper.map(entity, TextInfo.class);
        if (entity instanceof MenuInfoEntity) return modelMapper.map(entity, MenuInfo.class);
        return modelMapper.map(entity, TrackInfo.class);
    }

    private boolean isValidFileInfo(Map<String, Object> fileInfo) { return fileInfo.containsKey("filePath") && fileInfo.containsKey("id") && fileInfo.containsKey("fileSize"); }

    private boolean shouldDeleteFile(Map<String, Object> fileInfo) {
        File file = new File(String.valueOf(fileInfo.get("filePath")));
        if (!file.exists()) return true;
        try { return Files.size(file.toPath()) != Long.parseLong(String.valueOf(fileInfo.get("fileSize"))); } catch (IOException e) { return true; }
    }
}
