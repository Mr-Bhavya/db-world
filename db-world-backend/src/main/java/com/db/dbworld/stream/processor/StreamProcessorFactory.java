package com.db.dbworld.stream.processor;

import com.db.dbworld.payloads.MirrorStatus;
import com.db.dbworld.services.mirror.StatusService;

public class StreamProcessorFactory {

    public static FfmpegStreamProcessor createFfmpegProcessor() {
        return new FfmpegStreamProcessor();
    }

    public static FfmpegStreamProcessor createFfmpegProcessor(StatusService statusService,
                                                              MirrorStatus mirrorStatus) {
        return new FfmpegStreamProcessor(statusService, mirrorStatus);
    }

    public static GenericStreamProcessor createGenericProcessor() {
        return new GenericStreamProcessor();
    }

    public static GenericStreamProcessor createGenericProcessor(StatusService statusService,
                                                                MirrorStatus mirrorStatus) {
        return new GenericStreamProcessor(statusService, mirrorStatus);
    }
}