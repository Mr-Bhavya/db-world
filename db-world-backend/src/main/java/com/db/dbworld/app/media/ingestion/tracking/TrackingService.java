package com.db.dbworld.app.media.ingestion.tracking;

import com.db.dbworld.app.media.ingestion.pipeline.PipelineStepType;

import java.util.Map;

public interface TrackingService {

    void updateStatus(String jobId, MirrorStatus status);

    void updateStep(String jobId, PipelineStepType step);

    void updateProgress(String jobId, ProgressSnapshot progress);

    void fail(String jobId, String reason);

    void complete(String jobId);

    boolean isCancelled(String jobId);

    Map<String, Object> getAll();

    String getHtmlReport(String jobId);
}
