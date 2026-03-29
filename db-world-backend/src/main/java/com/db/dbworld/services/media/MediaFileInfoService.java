package com.db.dbworld.services.media;

import com.db.dbworld.entities.dbcinema.stream.MediaFileInfoEntity;
import com.db.dbworld.payloads.dbcinema.stream.MediaFileInfo;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * @deprecated Superseded by {@link com.db.dbworld.app.media.info.service.MediaInfoService}.
 * Still used by old StreamController / StreamServiceImpl until those are migrated.
 */
@Deprecated(forRemoval = true)
public interface MediaFileInfoService {

    MediaFileInfoEntity save(MediaFileInfoEntity mediaFileInfoEntity);

    List<MediaFileInfo> findAll();

    Optional<MediaFileInfo> findById(String id);

    List<MediaFileInfoEntity> findAllEntities();

    Optional<MediaFileInfoEntity> findEntityById(String id);

    List<MediaFileInfo> getAllFileInfoByRecordId(Long recordId);

    List<MediaFileInfoEntity> getAllFileInfoEntityByRecordId(Long recordId);
    
    Optional<MediaFileInfoEntity> findOneByFilePath(String path);

    String getFileInfoById(String id);

    List<Map<String, Object>> getAllFilePath();

    void deleteInfoById(String id);

    void deleteInfoByIds(List<String> ids);

    void deleteInfoByFilePath(String filePath);

    Map<String, Integer> cleanMediaFileInfo();
}
