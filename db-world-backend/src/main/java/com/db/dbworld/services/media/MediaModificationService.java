package com.db.dbworld.services.media;

import com.db.dbworld.entities.dbcinema.DBCinemaRecordsEntity;
import com.db.dbworld.handler.MediaFileHandler;
import com.db.dbworld.payloads.MirrorStatus;
import com.db.dbworld.payloads.mediafile.MediaFileDetails;
import com.db.dbworld.services.cinema.DBCinemaRecordsService;
import com.db.dbworld.services.mirror.StatusService;
import com.db.dbworld.utils.DbWorldConstants;
import com.db.dbworld.utils.MediaInfoUtils;
import lombok.extern.log4j.Log4j2;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.io.File;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import static org.eclipse.jetty.util.URIUtil.normalizePath;

@Log4j2
@Service
public class MediaModificationService {

    private final DBCinemaRecordsService dbCinemaRecordsService;
    private final StatusService statusService;
    private final MediaFileHandler mediaFileHandler;
    private final MediaInfoUtils mediaInfoUtils;

    private final ExecutorService mediaProcessingExecutor = Executors.newFixedThreadPool(3);

    public MediaModificationService(DBCinemaRecordsService dbCinemaRecordsService,
                                    StatusService statusService,
                                    MediaFileHandler mediaFileHandler, MediaInfoUtils mediaInfoUtils) {
        this.dbCinemaRecordsService = dbCinemaRecordsService;
        this.statusService = statusService;
        this.mediaFileHandler = mediaFileHandler;
        this.mediaInfoUtils = mediaInfoUtils;
    }

    @Async
    public CompletableFuture<Void> processMediaAsync(MirrorStatus mirrorStatus) {
        return CompletableFuture.runAsync(() -> {
            try {
                modifyMediaWithProgress(mirrorStatus);
            } catch (Exception e) {
                log.error("Media processing failed for ID: {}", mirrorStatus.getId(), e);
                statusService.logAndAppendHtml(mirrorStatus, "❌ Media processing failed: " + e.getMessage(), true);
                statusService.updateMirrorStatusWithFailed(mirrorStatus.getId(), "Media processing failed");
            }
        }, mediaProcessingExecutor);
    }

    private void modifyMediaWithProgress(MirrorStatus mirrorStatus) {

        try {
            statusService.logAndAppendHtml(mirrorStatus, "🔄 Starting media processing...", false);

            if (mirrorStatus.getRecordId() != null && mirrorStatus.getRecordId() > 0) {
                // Process as assigned file (with record ID)
                statusService.logAndAppendHtml(mirrorStatus, "📁 Processing with record ID: " + mirrorStatus.getRecordId(), false);
                DBCinemaRecordsEntity dbCinemaRecordsEntity = dbCinemaRecordsService.getRecordEntityById(mirrorStatus.getRecordId());
                String streamFilePath = buildStreamFilePath(mirrorStatus);

                MediaFileDetails mediaFileDetails = createMediaFileDetails(dbCinemaRecordsEntity, mirrorStatus, streamFilePath);

                try {
                    mediaFileHandler.processExistingAssignedFile(
                            new File(mirrorStatus.getTempFilePath()),
                            mediaFileDetails
                    );
                } catch (DataIntegrityViolationException e) {
                    // Handle duplicate entry specifically
                    String errorMsg = "Duplicate media file entry detected. File might already be processed.";
                    statusService.logAndAppendHtml(mirrorStatus, "⚠️ " + errorMsg, true);
                    statusService.logAndAppendHtml(mirrorStatus, "ℹ️ Skipping database entry as file already exists.", false);
                    // Continue with other processing if possible, or throw if critical
                    throw new RuntimeException("Duplicate media file entry: " + e.getMessage(), e);
                }
            } else {
                // Process as unassigned file (no record ID)
                statusService.logAndAppendHtml(mirrorStatus, "📁 Processing with unassign record id.", false);
                mediaFileHandler.processUnassignedFile(new File(mirrorStatus.getTempFilePath()));
            }

        } catch (Exception e) {
            statusService.logAndAppendHtml(mirrorStatus, "❌ Media processing error: " + e.getMessage(), true);
            throw new RuntimeException("Media processing failed", e);
        }
    }

    private String buildStreamFilePath(MirrorStatus mirrorStatus) {
        return String.format("%s/%s/%s/%s",
                normalizePath(DbWorldConstants.STREAM_HOME_PATH),
                "movies",
                mirrorStatus.getFolderName(),
                mirrorStatus.getFileName());
    }

    private MediaFileDetails createMediaFileDetails(DBCinemaRecordsEntity dbCinemaRecordsEntity,
                                                    MirrorStatus mirrorStatus,
                                                    String streamFilePath) {
        return new MediaFileDetails(
                dbCinemaRecordsEntity,
                dbCinemaRecordsEntity.getName(),
                mediaInfoUtils.getYearInfo(dbCinemaRecordsEntity),
                streamFilePath,
                mirrorStatus.getFolderName(),
                DbWorldConstants.RECORD_TYE.valueOf(dbCinemaRecordsEntity.getType().toUpperCase()),
                mirrorStatus.getRecordId(), null, null
        );
    }

}