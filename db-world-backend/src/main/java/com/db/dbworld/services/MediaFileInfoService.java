package com.db.dbworld.services;

import com.db.dbworld.entities.dbcinema.stream.MediaFileInfoEntity;
import com.db.dbworld.payloads.dbcinema.stream.MediaFileInfo;

import java.util.List;
import java.util.Map;

public interface MediaFileInfoService {

    MediaFileInfoEntity save(MediaFileInfoEntity mediaFileInfoEntity);

    List<MediaFileInfo> getAllFileInfoByRecordId(Long recordId);

    String getFileInfoById(String id);

    List<Map<String, Object>> getAllFilePath();

    void deleteInfoById(String id);

    void deleteInfoByIds(List<String> ids);

    void deleteInfoByFilePath(String filePath);

    Map<String, Integer> cleanMediaFileInfo();
}
