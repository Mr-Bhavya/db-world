package com.db.dbworld.services;

import com.db.dbworld.payloads.dbcinema.stream.MediaFileInfo;

import java.util.List;
import java.util.Map;

public interface MediaFileInfoService {

    List<MediaFileInfo> getAllFileInfoByRecordId(Long recordId);

    String getFileInfoById(String id);

    List<Map<String, String>> getAllFilePath();

    void deleteInfoById(String id);

}
