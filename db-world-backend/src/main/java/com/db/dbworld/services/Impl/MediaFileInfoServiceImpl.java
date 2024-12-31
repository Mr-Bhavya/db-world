package com.db.dbworld.services.Impl;

import com.db.dbworld.dao.dbcinema.stream.MediaFileInfoRepository;
import com.db.dbworld.entities.dbcinema.stream.*;
import com.db.dbworld.payloads.dbcinema.stream.*;
import com.db.dbworld.services.MediaFileInfoService;
import org.modelmapper.ModelMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class MediaFileInfoServiceImpl implements MediaFileInfoService {

    @Autowired
    private MediaFileInfoRepository mediaFileInfoRepository;

    @Autowired
    private ModelMapper modelMapper;

    @Override
    public List<MediaFileInfo> getAllFileInfoByRecordId(Long recordId) {
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
                }).toList();
    }
}
