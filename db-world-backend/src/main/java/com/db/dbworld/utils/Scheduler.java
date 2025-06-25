package com.db.dbworld.utils;

import com.db.dbworld.exceptions.DbWorldException;
import com.db.dbworld.services.MediaFileInfoService;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

@Log4j2
@Service
public class Scheduler {

    @Autowired
    private MediaFileInfoService mediaFileInfoService;

//    @Scheduled(fixedRate = 1000*60*30) // Every 30 minutes (in milliseconds)

}
