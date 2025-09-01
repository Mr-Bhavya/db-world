package com.db.dbworld.config;

import com.db.dbworld.entities.dbcinema.stream.MediaFileInfoEntity;
import com.db.dbworld.payloads.dbcinema.stream.MediaFileInfo;
import jakarta.annotation.PostConstruct;
import org.modelmapper.ModelMapper;
import org.springframework.stereotype.Component;


@Component
public class ModelMapperConfig {

    private final ModelMapper modelMapper;

    public ModelMapperConfig(ModelMapper modelMapper) {
        this.modelMapper = modelMapper;
    }

    @PostConstruct
    public void setupMappings() {
        modelMapper.typeMap(MediaFileInfoEntity.class, MediaFileInfo.class).addMappings(mapper -> {
            mapper.map(src -> src.getDbCinemaRecord().getId(),
                    MediaFileInfo::setDbCinemaRecordId);
        });

    }
}
