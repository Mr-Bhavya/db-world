package com.db.dbworld.utils;

import com.db.dbworld.services.MediaFileInfoService;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;

import java.io.File;
import java.util.List;
import java.util.Map;

@Log4j2
public class Scheduler {

    @Autowired
    private MediaFileInfoService mediaFileInfoService;

    @Scheduled(cron = "0 */2 * * *")
    public void checkMediaFilePath(){
        List<Map<String, String>> filePaths = mediaFileInfoService.getAllFilePath();
        if(filePaths != null && !filePaths.isEmpty()){
            filePaths.forEach(file -> {
                if(file.containsKey("filePath") && file.containsKey("id")){
                    if(!new File(file.get("filePath")).exists()){
                        mediaFileInfoService.deleteInfoById(file.get("id"));
                    }
                }else{
                    log.warn("not able to retrieve keys id and filePath : {}", file);
                }
            });
        }else{
            log.warn("FilePath list is empty");
        }
    }
}
