package com.db.dbworld.payloads;

import com.db.dbworld.utils.DbWorldConstants;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.InvalidPathException;
import java.nio.file.Path;
import java.util.Date;

@Getter
@Setter
@Service
@NoArgsConstructor
@AllArgsConstructor
public class MirrorStatus {
    private String id;
    private String timeStamp;
    private String userBy;
    private String fileUrl;
    private String fileName;
    private String fileType;
    private String filePath;
    private boolean extract;
    private String extractedFileName;
    private String extractedFilePath;
    private String tempFileName;
    private String tempFilePath;
    private String statusFilePath;
    private Long fileSize;
    private String currentStatus;
    private DownloadStatus downloadStatus;
    private YtDlp ytdlp;
    private boolean failed = false;
    private boolean cancelled = false;
    private boolean success = false;
    private boolean completed = false;

    public MirrorStatus(String fileUrl, String fileName, Long fileSize, boolean extract) {
        this.id = String.valueOf(new Date().getTime());
        this.timeStamp = this.id;
        this.tempFileName = timeStamp;
        this.currentStatus = "Downloading ...";
        this.fileUrl = fileUrl;
        this.fileName = fileName;
        this.fileSize = fileSize;
        this.filePath = DbWorldConstants.STREAM_HOME_PATH + "/" + fileName;
        this.tempFilePath = "download/" + tempFileName;
        this.extract = extract;
//        this.statusFilePath = "status/" + timeStamp + ".json";
        try {
            this.fileType = Files.probeContentType(Path.of(fileName));
        } catch (IOException | InvalidPathException e) {
            System.out.println(e.getMessage());
        }
        if (extract) {
            if (this.fileName.endsWith(".zip")) this.extractedFileName = this.fileName.replace(".zip", "");
            else if (this.fileName.endsWith(".rar")) this.extractedFileName = this.fileName.replace(".rar", "");
            else if (this.fileName.endsWith(".tar")) this.extractedFileName = this.fileName.replace(".tar", "");
            else if (this.fileName.endsWith(".7z")) this.extractedFileName = this.fileName.replace(".7z", "");
            this.extractedFilePath = DbWorldConstants.STREAM_HOME_PATH + "/" + extractedFileName;
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
        this.filePath = DbWorldConstants.STREAM_HOME_PATH + "/" + fileName;
        this.tempFilePath = "download/" + tempFileName;
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

        public DownloadStatus(long fileDownloaded, long fileRemaining, long totalFileSize) {
            this.fileDownloaded = fileDownloaded;
            this.fileRemaining = fileRemaining;
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
