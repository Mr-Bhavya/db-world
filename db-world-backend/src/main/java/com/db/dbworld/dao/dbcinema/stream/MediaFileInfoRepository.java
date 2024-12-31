package com.db.dbworld.dao.dbcinema.stream;

import com.db.dbworld.entities.dbcinema.stream.MediaFileInfoEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MediaFileInfoRepository extends JpaRepository<MediaFileInfoEntity, String> {
    List<MediaFileInfoEntity> findAllByDbCinemaRecordId(Long recordId);
}
