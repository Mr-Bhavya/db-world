package com.db.dbworld.services.Impl;

import com.db.dbworld.dao.dbcinema.stream.MediaFileInfoRepository;
import com.db.dbworld.entities.dbcinema.stream.*;
import com.db.dbworld.exceptions.DbWorldException;
import com.db.dbworld.exceptions.ResourceNotFoundException;
import com.db.dbworld.payloads.dbcinema.stream.*;
import com.db.dbworld.services.MediaFileInfoService;
import com.db.dbworld.utils.DbWorldConstants;
import com.db.dbworld.utils.DbWorldUtils;
import lombok.extern.log4j.Log4j2;
import org.modelmapper.ModelMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.CacheConfig;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.util.CollectionUtils;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Log4j2
@Service
@CacheConfig(cacheNames = "media-file")
public class MediaFileInfoServiceImpl implements MediaFileInfoService {

    @Autowired
    private MediaFileInfoRepository mediaFileInfoRepository;

    @Autowired
    private ModelMapper modelMapper;

    @Autowired
    private DbWorldUtils dbWorldUtils;

    @Override
    public MediaFileInfoEntity save(MediaFileInfoEntity mediaFileInfoEntity) {
        try {
            return mediaFileInfoRepository.save(mediaFileInfoEntity);
        }catch (Exception ex){
            throw new DbWorldException(ex.getMessage());
        }
    }

    @Override
//    @Cacheable(keyGenerator = DbWorldConstants.CUSTOM_REDIS_KEY_GENERATOR)
    public List<MediaFileInfo> getAllFileInfoByRecordId(Long recordId) {
        try {
            List<MediaFileInfoEntity> mediaFileInfoEntities = mediaFileInfoRepository.findAllByDbCinemaRecordId(recordId);
            return mediaFileInfoEntities.stream()
                    .map(mediaFileInfoEntity -> {
                        List<TrackInfoEntity> trackInfoEntities = mediaFileInfoEntity.getTrackInfos();
                        MediaFileInfo mediaFileInfo = modelMapper.map(mediaFileInfoEntity, MediaFileInfo.class);
                        mediaFileInfo.setTrackInfos(trackInfoEntities.stream().map(trackInfoEntity -> {
                            if (trackInfoEntity instanceof GeneralInfoEntity) {
                                return modelMapper.map(trackInfoEntity, GeneralInfo.class);
                            } else if (trackInfoEntity instanceof VideoInfoEntity) {
                                return modelMapper.map(trackInfoEntity, VideoInfo.class);
                            } else if (trackInfoEntity instanceof AudioInfoEntity) {
                                return modelMapper.map(trackInfoEntity, AudioInfo.class);
                            } else if (trackInfoEntity instanceof TextInfoEntity) {
                                return modelMapper.map(trackInfoEntity, TextInfo.class);
                            } else if (trackInfoEntity instanceof MenuInfoEntity) {
                                return modelMapper.map(trackInfoEntity, MenuInfo.class);
                            } else {
                                return modelMapper.map(trackInfoEntity, TrackInfo.class);
                            }
                        }).toList());
                        return mediaFileInfo;
                    }).collect(Collectors.toList());
        }catch (Exception ex){
            throw new DbWorldException(ex.getMessage());
        }
    }

    @Override
    @Cacheable(keyGenerator = DbWorldConstants.CUSTOM_REDIS_KEY_GENERATOR)
    public String getFileInfoById(String id) {
        try {
            return mediaFileInfoRepository.getFileInfoById(id).orElseThrow(()->new DbWorldException("No Information"));
        }catch (Exception ex){
            throw new DbWorldException(ex.getMessage());
        }
    }

    @Override
    public List<Map<String, Object>> getAllFilePath() {
        try {
            return mediaFileInfoRepository.getAllFilePath();
        }catch (Exception ex){
            throw new DbWorldException(ex.getMessage());
        }
    }

    @Override
    public void deleteInfoById(String id) {
        try {
            MediaFileInfoEntity mediaFileInfo = mediaFileInfoRepository.findById(id).orElseThrow(
                    () -> new ResourceNotFoundException("MediaFileInfo", "id", id)
            );
            mediaFileInfoRepository.delete(mediaFileInfo);
            dbWorldUtils.deleteFile(mediaFileInfo.getFilePath());
        }catch (Exception ex){
            throw new DbWorldException(ex.getMessage());
        }
    }

    @Override
    public void deleteInfoByIds(List<String> ids) {
        try {
            List<MediaFileInfoEntity> mediaFileInfos = mediaFileInfoRepository.findAllById(ids);
            mediaFileInfoRepository.deleteAll(mediaFileInfos);
            mediaFileInfos.forEach(mediaFileInfoEntity -> dbWorldUtils.deleteFile(mediaFileInfoEntity.getFilePath()));
        }catch (Exception ex){
            throw new DbWorldException(ex.getMessage());
        }
    }

    @Override
    public void deleteInfoByFilePath(String filePath) {
        try {
            List<MediaFileInfoEntity> mediaFileInfoEntities = mediaFileInfoRepository.findAllByFilePath(filePath);
            if(mediaFileInfoEntities != null && !mediaFileInfoEntities.isEmpty()){
                mediaFileInfoRepository.deleteAll(mediaFileInfoEntities);
            }
        }catch (Exception ex){
            throw new DbWorldException(ex.getMessage());
        }
    }

    @Override
    public Map<String, Integer> cleanMediaFileInfo() {
        log.info("Starting media file cleanup...");

        List<Map<String, Object>> filePaths = getAllFilePath();
        Map<String, Integer> result = new HashMap<>();

        if (CollectionUtils.isEmpty(filePaths)) {
            log.warn("No media file paths found in the database.");
            result.put("totalCount", 0);
            result.put("deletedFilesCount", 0);
            return result;
        }

        log.info("Loaded {} media file paths from the database.", filePaths.size());

        List<String> idsToDelete = filePaths.stream()
                .filter(this::isValidFileInfo)
                .filter(this::shouldDeleteFile)
                .map(fileInfo -> {
                    log.info("Scheduled for deletion: {}", fileInfo.get("filePath"));
                    return String.valueOf(fileInfo.get("id")); // ✅ safe conversion
                })
                .collect(Collectors.toList());

        if (!idsToDelete.isEmpty()) {
            deleteInfoByIds(idsToDelete);
            log.info("Deleted {} media file entries.", idsToDelete.size());
        } else {
            log.info("No invalid media files found to delete.");
        }

        result.put("totalCount", filePaths.size());
        result.put("deletedFilesCount", idsToDelete.size());

        log.info("Media file cleanup completed.");
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
        return !file.exists() || isFileSizeMismatch(file, String.valueOf(fileInfo.get("fileSize")));
    }


    private boolean isFileSizeMismatch(File file, String expectedFileSize) {
        try {
            long actualFileSize = Files.size(file.toPath());
            return !Long.toString(actualFileSize).equalsIgnoreCase(expectedFileSize);
        } catch (IOException e) {
            log.error("Error checking file size for {}: {}", file.getPath(), e.getMessage());
            throw new DbWorldException(e.getMessage());
        }
    }
}
