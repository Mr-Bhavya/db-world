package com.db.dbworld.app.media.ingestion.pipeline;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class DefaultIngestionPipelineFailureReasonTest {

    @Test
    void usesFirstMeaningfulMessageInCauseChain() {
        RuntimeException e = new RuntimeException(null, new IllegalStateException("disk unmounted"));
        assertEquals("disk unmounted", DefaultIngestionPipeline.describeFailure(e));
    }

    @Test
    void neverReportsNull() {
        assertEquals("Unexpected error (NullPointerException)",
                DefaultIngestionPipeline.describeFailure(new RuntimeException(new NullPointerException())));
    }
}
