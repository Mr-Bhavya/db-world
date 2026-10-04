package com.db.dbworld.app.media.ingestion.processing.fs;

import com.db.dbworld.app.media.ingestion.model.IngestionContext;

import java.nio.file.Path;

public interface FileStorageService {

    Path resolveTempDir(IngestionContext ctx);

    Path resolveFinalDir(IngestionContext ctx);

    Path resolveTempFile(IngestionContext ctx);

    Path resolveFinalFile(IngestionContext ctx);

    void prepareDirectories(IngestionContext ctx);

    void moveToFinal(IngestionContext ctx);

    /**
     * Removes the job's temp folder, and any parents below the temp root, once they are empty.
     * Called after the job's temp artifacts are deleted. Best-effort: never throws.
     */
    void removeEmptyTempDirs(IngestionContext ctx);
}
