package com.db.dbworld.core.processor;

public class StreamProcessorFactory {

    private StreamProcessorFactory() {}

    public static FfmpegStreamProcessor createFfmpegProcessor() {
        return new FfmpegStreamProcessor();
    }

    public static GenericStreamProcessor createGenericProcessor() {
        return new GenericStreamProcessor();
    }

    public static YtDlpStreamProcessor createYtDlpProcessor() {
        return new YtDlpStreamProcessor();
    }
}
