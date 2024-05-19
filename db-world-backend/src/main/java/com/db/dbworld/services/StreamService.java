package com.db.dbworld.services;

import org.springframework.core.io.InputStreamResource;
import org.springframework.http.ResponseEntity;

import java.io.File;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;

public interface StreamService {

    ResponseEntity<InputStreamResource> getStreamResource(Path path, final String range);
    ResponseEntity<InputStreamResource> getDownloadResource(Path path, String range);
    List<HashMap<String, Object>> getList(String path);
    ArrayList<File> getListRecursive(Path dir);
    HashMap<String, Object> createDetails(Path path);
    Long getFileSize(Path path);
}
