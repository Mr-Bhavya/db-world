package com.db.dbworld.controllers;

import com.db.dbworld.exceptions.DbWorldException;
import com.db.dbworld.payloads.ApiResponse;
import com.db.dbworld.security.JwtHelper;
import com.db.dbworld.services.StreamService;
import com.db.dbworld.utils.DbWorldConstants;
import com.db.dbworld.utils.DbWorldUtils;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.web.bind.annotation.*;

import java.io.File;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Log4j2
@RestController
@RequestMapping("/api/stream")
@EnableMethodSecurity(prePostEnabled = true)
public class StreamController {

    @Autowired
    private StreamService streamService;
    @Autowired
    private DbWorldUtils dbWorldUtils;
    @Autowired
    private JwtHelper jwtHelper;
    private Map<Long, String> video_cache = new HashMap<>();
    private Map<String, List<String>> download_cache = new HashMap<>();
    private Map<String, List<String>> watch_cache = new HashMap<>();

    @RequestMapping(value = "/list", method = RequestMethod.GET)
    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
    public ApiResponse getMediaList(@RequestParam(value = "path", defaultValue = "") String path) {
        List<HashMap<String, Object>> mediaList = null;
        mediaList = streamService.getList(path);
//            if(path.equals("")){
//                mediaList.addAll(getMediaList(Path.of("" +path)));
//            }
        return new ApiResponse(HttpStatus.OK, true, mediaList);
    }

    @GetMapping(value = "/watch/{fileId}")
//    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
    public ResponseEntity<InputStreamResource> watchFileOnline(@RequestHeader(value = "Range", required = false) String rangeHeader,
                                                               @PathVariable(name = "fileId") @Valid @NotNull long fileId,
                                                               @RequestParam(name = "t") String token) {
        Path path = null;
        if (video_cache.containsKey(fileId)) {
            path = Path.of(video_cache.get(fileId));
        } else {
            Path mediaDirPath = new File(DbWorldConstants.STREAM_HOME_PATH).toPath();
            ArrayList<File> files = streamService.getListRecursive(mediaDirPath);
            List<File> filteredFiles = files.stream().filter(file -> streamService.getFileSize(file.toPath()) == fileId).toList();
            if (filteredFiles.size() == 0) {
                throw new DbWorldException(HttpStatus.BAD_REQUEST, "Streamable file is not found.");
            }
            path = filteredFiles.get(0).toPath();
            video_cache.put(fileId, path.toString());
        }

        String username = jwtHelper.getUsernameFromToken(token);
        Map<String, Object> res = catchUpdate(username, watch_cache, path.toString());
        watch_cache = (Map<String, List<String>>) res.get("cache");
        if((boolean) res.get("print")){
            log.info("user '{}' is watching file - {}", username, path);
        }
        return streamService.getStreamResource(path, rangeHeader);
    }

//    @GetMapping(value = "/download/{fileId}", produces = MediaType.APPLICATION_OCTET_STREAM_VALUE)
//    public ResponseEntity<InputStreamResource> downloadFile(@PathVariable(name = "fileId") @Valid @NotNull long fileId) {
//        Path path = null;
//        if (video_cache.containsKey(fileId)) {
//            path = Path.of(video_cache.get(fileId));
//        } else {
//            Path mediaDirPath = new File(VIDEO_HOME_PATH).toPath();
//            ArrayList<File> files = streamService.getListRecursive(mediaDirPath);
//            List<File> filteredFiles = files.stream().filter(file -> streamService.getFileSize(file.toPath()) == fileId).toList();
//            if (filteredFiles.size() == 0) {
//                throw new DbWorldException(HttpStatus.BAD_REQUEST, "Streamable file is not found.");
//            }
//            path = filteredFiles.get(0).toPath();
//            video_cache.put(fileId, path.toString());
//        }
//        log.info("user was downloaded file - {}", path);
//        return streamService.getDownloadResource(path);
//    }

    @GetMapping(value = "/download/{fileId}", produces = MediaType.APPLICATION_OCTET_STREAM_VALUE)
    public ResponseEntity<InputStreamResource> downloadFile(@RequestHeader(value = "Range", required = false) String rangeHeader,
                                                            @PathVariable(name = "fileId") @Valid @NotNull long fileId,
                                                            @RequestParam("t") String token) {
        Path path = null;
        if (video_cache.containsKey(fileId)) {
            path = Path.of(video_cache.get(fileId));
        } else {
            Path mediaDirPath = new File(DbWorldConstants.STREAM_HOME_PATH).toPath();
            ArrayList<File> files = streamService.getListRecursive(mediaDirPath);
            List<File> filteredFiles = files.stream().filter(file -> streamService.getFileSize(file.toPath()) == fileId).toList();
            if (filteredFiles.size() == 0) {
                throw new DbWorldException(HttpStatus.BAD_REQUEST, "Streamable file is not found.");
            }
            path = filteredFiles.get(0).toPath();
            video_cache.put(fileId, path.toString());
        }

        // Create User cache and print log for first time user download file.
        String username = jwtHelper.getUsernameFromToken(token);
        Map<String, Object> res = catchUpdate(username, download_cache, path.toString());
        download_cache = (Map<String, List<String>>) res.get("cache");
        if((boolean) res.get("print")){
            log.info("user '{}' was downloaded file - {}", username, path);
        }
        return streamService.getDownloadResource(path, rangeHeader);
    }

    @GetMapping(value = "/search")
    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
    public ApiResponse searchFile(@Valid @NotEmpty @RequestParam(value = "q", defaultValue = "search") String query) {
        ArrayList<File> allFiles = streamService.getListRecursive(Path.of(DbWorldConstants.STREAM_HOME_PATH));
        List<HashMap<String, Object>> filteredFiles = allFiles.stream()
                .filter(file -> file.toPath().getFileName().toString()
                        .toLowerCase().replace(".", " ")
                        .replace("_", " ")
                        .contains(query.toLowerCase()) && file.isFile())
                .map(file -> streamService.createDetails(file.toPath())).toList();
        return new ApiResponse(HttpStatus.OK, true, filteredFiles);
    }

    public Map<String, Object> catchUpdate(String username, Map<String, List<String>> cache, String path) {
        boolean log = false;
        // Create User cache and print log for first time user download file.
        if(cache.containsKey(username)){
            List<String> filteredPath = cache.get(username).stream().filter(existingPath -> existingPath.equalsIgnoreCase(path)).toList();
            if(filteredPath.size()==0){
                cache.get(username).add(path);
                log=true;
            }
        }else{
            List<String> tempList = new ArrayList<>();
            tempList.add(path);
            cache.put(username, tempList);
            log=true;
        }

        Map<String, Object> temp = new HashMap<>();
        temp.put("cache", cache);
        temp.put("print", log);
        return temp;
    }

}
