package com.db.dbworld.services;

import org.springframework.core.io.InputStreamResource;
import org.springframework.http.ResponseEntity;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.io.File;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.concurrent.CompletableFuture;

public interface StreamService {

    ResponseEntity<Void> streamFileByCdn(String user, Path path, String rangeHeader, boolean inline);
    List<HashMap<String, Object>> getList(String path);
    ArrayList<File> getListRecursive(Path dir);
    HashMap<String, Object> createDetails(Path path);

}
