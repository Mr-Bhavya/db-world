package com.db.dbworld.services.media;

import com.db.dbworld.helpers.DbWorldRecords;
import com.db.dbworld.payloads.dbcinema.stream.MediaFileInfo;
import org.springframework.http.ResponseEntity;

import java.nio.file.Path;
import java.util.List;
import java.util.Optional;

public interface StreamService {

    ResponseEntity<Void> streamFileByCdn(String user, Path path, String rangeHeader, boolean inline);
    List<DbWorldRecords.StreamableFileInfo> getListRecursive(Path dir);
    List<DbWorldRecords.StreamableFileInfo> getAllStreamableFiles();
    boolean matchesQuery(String fileName, String query);
    Optional<Path> findFileById(String fileId);
    DbWorldRecords.StreamableFileInfo createDetails(Path path);
    List<MediaFileInfo> parseMediaInfo(String jsonOutput);
}
