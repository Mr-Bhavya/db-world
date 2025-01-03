package com.db.dbworld.services.Impl;

import com.db.dbworld.dao.dbcinema.stream.MediaFileInfoRepository;
import com.db.dbworld.entities.dbcinema.stream.*;
import com.db.dbworld.exceptions.DbWorldException;
import com.db.dbworld.payloads.dbcinema.stream.*;
import com.db.dbworld.services.MediaFileInfoService;
import com.db.dbworld.utils.DbWorldConstants;
import org.modelmapper.ModelMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.CacheConfig;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@CacheConfig(cacheNames = "media-file")
public class MediaFileInfoServiceImpl implements MediaFileInfoService {

    @Autowired
    private MediaFileInfoRepository mediaFileInfoRepository;

    @Autowired
    private ModelMapper modelMapper;

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
    public List<Map<String, String>> getAllFilePath() {
        try {
            return mediaFileInfoRepository.getAllFilePath();
        }catch (Exception ex){
            throw new DbWorldException(ex.getMessage());
        }
    }

    @Override
    public void deleteInfoById(String id) {
        try {
            mediaFileInfoRepository.deleteById(id);
        }catch (Exception ex){
            throw new DbWorldException(ex.getMessage());
        }
    }

    @Override
    public void deleteInfoByFilePath(String filePath) {
        try {
            mediaFileInfoRepository.deleteAllByFilePath(filePath);
        }catch (Exception ex){
            throw new DbWorldException(ex.getMessage());
        }
    }
}
