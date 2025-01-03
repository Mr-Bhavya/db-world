package com.db.dbworld.payloads;

import com.db.dbworld.utils.DbWorldConstants;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.InvalidPathException;
import java.nio.file.Path;
import java.util.Date;

@Log4j2
@Getter
@Setter
@Service
@NoArgsConstructor
@AllArgsConstructor
public class MirrorStatus {

    private String id;
    private String timeStamp;
    private Long recordId;
    private String userBy;
    private String folderName;
    private String fileUrl;
    private String fileName;
    private String fileType;
    private String filePath;
    private String recordIdPath;
    private boolean extract;
    private String extractedFileName;
    private String extractedFilePath;
    private String tempFileName;
    private String tempFilePath;
    private String tempRecordIdPath;
    private String statusFilePath;
    private Long fileSize;
    private String currentStatus;
    private DownloadStatus downloadStatus;
    private YtDlp ytdlp;
    private boolean pause = false;
    private boolean failed = false;
    private boolean cancelled = false;
    private boolean success = false;
    private boolean completed = false;
    private String message;

    public MirrorStatus(String folderName, String fileUrl, String fileName, Long fileSize, boolean extract) {
        this.id = String.valueOf(new Date().getTime());
        this.timeStamp = this.id;
        this.recordId = Long.valueOf(folderName.split("-")[0]);
        this.folderName = folderName;
        this.tempFileName = timeStamp;
        this.currentStatus = "Downloading ...";
        this.fileUrl = fileUrl;
        this.fileName = fileName;
        this.fileSize = fileSize;
        if(DbWorldConstants.INTEGRATION_FOLDER_PATH == null || DbWorldConstants.INTEGRATION_FOLDER_PATH.equals("null")){
            log.warn("integrationFolderPath is null");
            DbWorldConstants.INTEGRATION_FOLDER_PATH = "/ext_hdisk/dbworld/integration/";
        }
        this.recordIdPath = DbWorldConstants.INTEGRATION_FOLDER_PATH + File.separator + folderName;
        this.tempRecordIdPath = DbWorldConstants.TEMP_DOWNLOAD_PATH + folderName;
        this.filePath = recordIdPath + File.separator + fileName;
        this.tempFilePath = tempRecordIdPath + File.separator + tempFileName;
        this.extract = extract;
        try {
            this.fileType = Files.probeContentType(Path.of(fileName));
            Files.createDirectories(Path.of(tempRecordIdPath));
            Files.createDirectories(Path.of(recordIdPath));
        } catch (IOException | InvalidPathException e) {
            System.out.println(e.getMessage());
        }
        if (extract) {
            if (this.fileName.endsWith(".zip")) this.extractedFileName = this.fileName.replace(".zip", "");
            else if (this.fileName.endsWith(".rar")) this.extractedFileName = this.fileName.replace(".rar", "");
            else if (this.fileName.endsWith(".tar")) this.extractedFileName = this.fileName.replace(".tar", "");
            else if (this.fileName.endsWith(".7z")) this.extractedFileName = this.fileName.replace(".7z", "");
            this.extractedFilePath = DbWorldConstants.INTEGRATION_FOLDER_PATH + File.separator + extractedFileName;
        }
    }

    public MirrorStatus (YtDlp ytDlp){
        this.ytdlp = ytDlp;
        this.id = String.valueOf(new Date().getTime());
        this.timeStamp = this.id;
        this.tempFileName = timeStamp;
        this.currentStatus = "Downloading ...";
        this.fileUrl = this.ytdlp.url;
        this.fileName = this.ytdlp.fileName;
        if(this.fileName.contains("|") || this.fileName.contains("/") || this.fileName.contains("\\")){
            this.fileName = this.fileName.replace("|","")
                    .replace("/", "")
                    .replace("\\","");
        }
        this.fileSize = this.ytdlp.fileSize;
        this.filePath = DbWorldConstants.INTEGRATION_FOLDER_PATH + File.separator + fileName;
        this.tempFilePath = DbWorldConstants.TEMP_DOWNLOAD_PATH + tempFileName;
        this.extract = false;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DownloadStatus {
        private long speed;
        private long fileDownloaded;
        private long fileRemaining;
        private long eta;
        private long totalFileSize;
        private long lastTime;
        private long lastDownloadedBytes;

        public DownloadStatus(long fileDownloaded, long fileRemaining, long totalFileSize) {
            this.fileDownloaded = fileDownloaded;
            this.fileRemaining = fileRemaining;
            this.totalFileSize = totalFileSize;
        }

        public DownloadStatus(long fileDownloaded, long totalFileSize) {
            this.fileDownloaded = fileDownloaded;
            this.fileRemaining = totalFileSize <= 0 ? 0 : totalFileSize - fileDownloaded;
            this.totalFileSize = totalFileSize;
        }

    }

    @Getter
    @Setter
    public static class YtDlp {
        private String url;
        private String fileName;
        private long fileSize;
        private String videoITag;
        private String audioITag;
        private boolean onlyAudio;
    }

}
