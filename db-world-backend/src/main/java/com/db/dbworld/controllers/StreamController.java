package com.db.dbworld.controllers;

import com.db.dbworld.exceptions.DbWorldException;
import com.db.dbworld.payloads.ApiResponse;
import com.db.dbworld.payloads.user.UserCinemaDataDto;
import com.db.dbworld.security.JwtHelper;
import com.db.dbworld.services.StreamService;
import com.db.dbworld.services.UserService;
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

import javax.security.sasl.AuthenticationException;
import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

@Log4j2
@RestController
@RequestMapping("/api/stream")
@EnableMethodSecurity(prePostEnabled = true)
@CrossOrigin
public class StreamController {

    @Autowired
    private StreamService streamService;
    @Autowired
    private DbWorldUtils dbWorldUtils;
    @Autowired
    private JwtHelper jwtHelper;
    @Autowired
    private UserService userService;
    
    
    private final Map<Long, String> video_cache = new HashMap<>();
    private Map<String, List<String>> download_cache = new HashMap<>();
    private Map<String, List<String>> watch_cache = new HashMap<>();
    public static final String CACHE_TYPE_DOWNLOAD = "CACHE_TYPE_DOWNLOAD";
    public static final String CACHE_TYPE_WATCH = "CACHE_TYPE_WATCH";

    @RequestMapping(value = "/list", method = RequestMethod.GET)
    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
    public ApiResponse<List<HashMap<String, Object>>> getMediaList(@RequestParam(value = "path", defaultValue = "") String path) {
        List<HashMap<String, Object>> mediaList = null;
        mediaList = streamService.getList(path);
        return new ApiResponse<>(HttpStatus.OK, true, mediaList);
    }

    @PutMapping("/file/{fileId}")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<String> renameFile(@PathVariable(value = "fileId") long fileId, @RequestBody String newName){
        List<File> files = getStreamableFilesRecursive();
        List<File> filteredFiles = files.stream().filter(file -> streamService.getFileSize(file.toPath()) == fileId).toList();
        if (filteredFiles.isEmpty()) {
            throw new DbWorldException(HttpStatus.BAD_REQUEST, "File is not found for ID: "+ fileId +" is not found.");
        }
        try {
            Files.move(filteredFiles.get(0).toPath(), Path.of(filteredFiles.get(0).getParent() + "/"+newName));
        } catch (IOException e) {
            throw new DbWorldException(HttpStatus.INTERNAL_SERVER_ERROR, e.getMessage());
        }
        if(video_cache.containsKey(fileId)){
            video_cache.put(fileId, Path.of(filteredFiles.get(0).getParent() + "/"+newName).toString());
        }
        String[] message = new String[] {"File", filteredFiles.get(0).getAbsolutePath(), "is rename to", filteredFiles.get(0).getParent() + "/"+newName};
        log.info(String.join(" ", message));
        return new ApiResponse<>(HttpStatus.OK, true, String.join(" ", message));
    }

    @DeleteMapping("/file/{fileId}")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<String> deleteFile(@PathVariable(value = "fileId") long fileId){
        List<File> files = getStreamableFilesRecursive();
        List<File> filteredFiles = files.stream().filter(file -> streamService.getFileSize(file.toPath()) == fileId).toList();
        if (filteredFiles.isEmpty()) {
            throw new DbWorldException(HttpStatus.BAD_REQUEST, "File is not found for ID: "+ fileId +" is not found.");
        }
        dbWorldUtils.deleteFile(filteredFiles.get(0).getAbsolutePath());
        String[] message = new String[] {"File", filteredFiles.get(0).getAbsolutePath(), "is initiate for delete."};
        log.info(String.join(" ", message));
        return new ApiResponse<>(HttpStatus.OK, true, String.join(" ", message));
    }

    @GetMapping(value = "/watch/{fileId}")
    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
    public CompletableFuture<ResponseEntity<InputStreamResource>> watchFileOnline(@RequestHeader(value = "Range", required = false) String rangeHeader,
                                                               @PathVariable(name = "fileId") @Valid @NotNull long fileId,
                                                               @RequestParam(name = "t") String token) {
        Path path = null;
        if (video_cache.containsKey(fileId)) {
            path = Path.of(video_cache.get(fileId));
        } else {
            List<File> files = getStreamableFilesRecursive();
            List<File> filteredFiles = files.stream().filter(file -> streamService.getFileSize(file.toPath()) == fileId).toList();
            if (filteredFiles.isEmpty()) {
                throw new DbWorldException(HttpStatus.BAD_REQUEST, "Streamable file is not found.");
            }
            path = filteredFiles.get(0).toPath();
            video_cache.put(fileId, path.toString());
        }
        // Create User cache and print log for first time user download file.
        catchUpdate(token, path.toString(), CACHE_TYPE_WATCH);
        return streamService.getStreamResource(path, rangeHeader);
    }

    @GetMapping(value = "/download/{fileId}", produces = MediaType.APPLICATION_OCTET_STREAM_VALUE)
    public CompletableFuture<ResponseEntity<InputStreamResource>> downloadFile(@RequestHeader(value = "Range", required = false) String rangeHeader,
                                                                              @PathVariable(name = "fileId") @Valid @NotNull long fileId,
                                                                              @RequestParam("t") String token) throws AuthenticationException {
        Path path = null;
        if (video_cache.containsKey(fileId)) {
            path = Path.of(video_cache.get(fileId));
        } else {
            List<File> files = getStreamableFilesRecursive();
            List<File> filteredFiles = files.stream().filter(file -> streamService.getFileSize(file.toPath()) == fileId).toList();
            if (filteredFiles.isEmpty()) {
                throw new DbWorldException(HttpStatus.BAD_REQUEST, "Streamable file is not found.");
            }
            path = filteredFiles.get(0).toPath();
            video_cache.put(fileId, path.toString());
        }
        // Create User cache and print log for first time user download file.
        catchUpdate(token, path.toString(), CACHE_TYPE_DOWNLOAD);
        return streamService.getDownloadResource(path, rangeHeader);
    }

    @GetMapping(value = "/search")
    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
    public ApiResponse<List<HashMap<String, Object>>> searchFile(@Valid @NotEmpty @RequestParam(value = "q", defaultValue = "search") String query) {
        UserCinemaDataDto userCinemaDataDto = new UserCinemaDataDto();
        userCinemaDataDto.setSearch_keyword(query);
        userService.updateUserCinemaData(userCinemaDataDto, null);

        List<File> files = getStreamableFilesRecursive();
        List<HashMap<String, Object>> filteredFiles = files.stream()
                .filter(file -> file.toPath().getFileName().toString()
                        .toLowerCase().replace(".", " ")
                        .replace("_", " ")
                        .contains(query.toLowerCase()) && file.isFile())
                .map(file -> streamService.createDetails(file.toPath())).toList();
        return new ApiResponse<>(HttpStatus.OK, true, filteredFiles);
    }

    private Map<String, Object> catchUpdate(String username, Map<String, List<String>> cache, String path) {
        boolean log = false;
        // Create User cache and print log for first time user download file.
        if (cache.containsKey(username)) {
            List<String> filteredPath = cache.get(username).stream().filter(existingPath -> existingPath.equalsIgnoreCase(path)).toList();
            if (filteredPath.isEmpty()) {
                cache.get(username).add(path);
                log = true;
            }
        } else {
            List<String> tempList = new ArrayList<>();
            tempList.add(path);
            cache.put(username, tempList);
            log = true;
        }

        Map<String, Object> temp = new HashMap<>();
        temp.put("cache", cache);
        temp.put("print", log);
        return temp;
    }

    private List<File> getStreamableFilesRecursive() {
        Path STREAM_HOME_PATH = Path.of(DbWorldConstants.STREAM_HOME_PATH);
        Path EXTERNAL_STREAM_HOME_PATH = Path.of(DbWorldConstants.EXTERNAL_STREAM_HOME_PATH);
        ArrayList<File> files = streamService.getListRecursive(STREAM_HOME_PATH);
        files.addAll(streamService.getListRecursive(EXTERNAL_STREAM_HOME_PATH));
        return files;
    }

    private void catchUpdate(String token, String path, String cacheType){
        String tempUser = dbWorldUtils.getUserFromToken(token);
        String username = tempUser != null ? tempUser : "someone";
        if(cacheType.equals(CACHE_TYPE_DOWNLOAD)){
            Map<String, Object> res = catchUpdate(username, download_cache, path);
            download_cache = (Map<String, List<String>>) res.get("cache");
            if ((boolean) res.get("print")) {
                log.info("user '{}' was downloaded file - {}", username, path);
                if(!username.equalsIgnoreCase("someone")){
                    UserCinemaDataDto userCinemaDataDto = new UserCinemaDataDto();
                    userCinemaDataDto.setDownload_file(path);
                    userService.updateUserCinemaData(userCinemaDataDto, username);
                }
            }
        }else if(cacheType.equals(CACHE_TYPE_WATCH)){
            Map<String, Object> res = catchUpdate(username, watch_cache, path);
            watch_cache = (Map<String, List<String>>) res.get("cache");
            if ((boolean) res.get("print")) {
                log.info("user '{}' is watching file - {}", username, path);
                if(!username.equalsIgnoreCase("someone")){
                    UserCinemaDataDto userCinemaDataDto = new UserCinemaDataDto();
                    userCinemaDataDto.setStream_file(path);
                    userService.updateUserCinemaData(userCinemaDataDto, username);
                }
            }
        }

    }

}
