package com.db.dbworld.payloads.mediafile;

import com.db.dbworld.entities.dbcinema.DBCinemaRecordsEntity;
import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class MediaFileDetails {
    DBCinemaRecordsEntity dbCinemaRecordsEntity;
    String name;
    String year;
    String streamFilePath;
    String recordIdFolder;
    String recordType;
    Long recordId;
    String season;
    String episode;
}
