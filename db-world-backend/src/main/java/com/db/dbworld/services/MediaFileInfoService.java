package com.db.dbworld.services;

import com.db.dbworld.payloads.dbcinema.stream.MediaFileInfo;

import java.util.List;

public interface MediaFileInfoService {

    List<MediaFileInfo> getAllFileInfoByRecordId(Long recordId);

}
