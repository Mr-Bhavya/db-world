package com.db.dbworld.app.media.ingestion.model;

import com.db.dbworld.app.media.ingestion.pipeline.PipelineStepType;
import com.db.dbworld.app.media.ingestion.tracking.MirrorStatus;
import com.db.dbworld.app.media.ingestion.tracking.log.LogCollector;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.util.concurrent.atomic.AtomicBoolean;

@Getter
@Setter
public class IngestionContext {

    private String jobId;
    private Long recordId;
    private String user;
    private Instant startedAt;

    private IngestionRequest request;

    private SourceMetadata source;
    private DownloadResult download;
    private ProcessingResult processing;

    private MirrorStatus status;
    private PipelineStepType currentStep;
    private boolean queueManaged;

    /** Set once an archive download has been extracted, so the extraction step doesn't run twice. */
    private boolean archiveExtracted;

    /** Set when the job was manually released ("Run now") to run in parallel — the pipeline then lets
     *  it bypass the serial processing cap and the Option-B download-slot reclaim. */
    private boolean parallel;

    private String message;
    private String htmlReport;

    private LogCollector logCollector = new LogCollector();
    private final AtomicBoolean cancellationFlag = new AtomicBoolean(false);

    /**
     * The linked record id, read LIVE from the request so a mid-flight edit (add/fix the record
     * link while the job is still downloading) is honoured at processing time. Falls back to the
     * snapshot field only if the request is somehow absent. (Lombok skips generating this getter
     * because it's defined here.)
     */
    public Long getRecordId() {
        return request != null && request.getRecordId() != null ? request.getRecordId() : recordId;
    }

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
