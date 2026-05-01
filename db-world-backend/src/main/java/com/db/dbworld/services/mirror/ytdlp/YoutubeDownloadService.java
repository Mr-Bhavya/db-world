package com.db.dbworld.services.mirror.ytdlp;

import com.db.dbworld.core.exception.ProcessExecutionException;
import com.db.dbworld.payloads.mirror.ytdlp.YoutubeDownloadRequest;
import org.springframework.stereotype.Service;

/**
 * @deprecated yt-dlp wrapper superseded by {@link com.db.dbworld.app.media.ingestion.download.YtDlpDownloadStrategy}
 * in the new ingestion pipeline.
 */
@Deprecated(forRemoval = true)
@Service
public interface YoutubeDownloadService {

    String executeYtDownload(YoutubeDownloadRequest request) throws ProcessExecutionException;

    String getYoutubeVideoInfo(String videoUrl) throws ProcessExecutionException;

    String getDownloadedFilename(YoutubeDownloadRequest request) throws ProcessExecutionException;
}
