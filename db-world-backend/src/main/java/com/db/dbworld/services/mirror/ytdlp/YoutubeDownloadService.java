package com.db.dbworld.services.mirror.ytdlp;

import com.db.dbworld.exceptions.ProcessExecutionException;
import com.db.dbworld.payloads.mirror.ytdlp.YoutubeDownloadRequest;
import org.springframework.stereotype.Service;

@Service
public interface YoutubeDownloadService {

    String executeYtDownload(YoutubeDownloadRequest request) throws ProcessExecutionException;

    String getYoutubeVideoInfo(String videoUrl) throws ProcessExecutionException;

    String getDownloadedFilename(YoutubeDownloadRequest request) throws ProcessExecutionException;
}
