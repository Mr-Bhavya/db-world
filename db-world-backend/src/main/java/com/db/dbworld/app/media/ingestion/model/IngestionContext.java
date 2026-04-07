package com.db.dbworld.app.media.ingestion.model;

import com.db.dbworld.app.media.ingestion.pipeline.PipelineStepType;
import com.db.dbworld.app.media.ingestion.tracking.MirrorStatus;
import com.db.dbworld.app.media.ingestion.tracking.log.LogCollector;
import lombok.Getter;
import lombok.Setter;

import java.util.concurrent.atomic.AtomicBoolean;

@Getter
@Setter
public class IngestionContext {

    private String jobId;
    private Long recordId;
    private String user;

    private IngestionRequest request;

    private SourceMetadata source;
    private DownloadResult download;
    private ProcessingResult processing;

    private MirrorStatus status;
    private PipelineStepType currentStep;
    private boolean queueManaged;

    private String message;
    private String htmlReport;

    private LogCollector logCollector = new LogCollector();
    private final AtomicBoolean cancellationFlag = new AtomicBoolean(false);

    public void log(String step, String msg) {
        logCollector.info(step, msg);
    }

    public void logError(String step, String msg) {
        logCollector.error(step, msg);
    }

    public boolean isCancelled() {
        return cancellationFlag.get();
    }

    public void cancel() {
        cancellationFlag.set(true);
    }
}
