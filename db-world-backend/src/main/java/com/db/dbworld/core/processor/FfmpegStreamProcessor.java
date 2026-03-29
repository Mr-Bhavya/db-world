package com.db.dbworld.core.processor;

import lombok.extern.log4j.Log4j2;

@Log4j2
public class FfmpegStreamProcessor extends StreamProcessor {

    public FfmpegStreamProcessor() {
        super();
    }

    @Override
    public void processLine(String line, boolean isErrorStream) {
        if (isErrorStream) {
            if (isActualError(line)) {
                log.error("[ffmpeg-error]: {}", line);
            } else if (isProgressLine(line)) {
                log.debug("[ffmpeg-progress]: {}", line);
            } else if (isHeaderLine(line)) {
                log.info("[ffmpeg-header]: {}", line);
            } else if (isStreamInfoLine(line)) {
                log.info("[ffmpeg-stream]: {}", line);
            } else if (isMappingLine(line)) {
                log.info("[ffmpeg-mapping]: {}", line);
            } else if (isOutputLine(line)) {
                log.info("[ffmpeg-output]: {}", line);
            } else if (isWarningLine(line)) {
                log.warn("[ffmpeg-warning]: {}", line);
            } else {
                log.info("[ffmpeg-info]: {}", line);
            }
        } else {
            log.info("[ffmpeg-stdout]: {}", line);
        }
    }

    private boolean isActualError(String line) {
        if (line == null || line.trim().isEmpty()) return false;
        String lower = line.toLowerCase();
        return lower.contains("error") ||
                lower.contains("failed") ||
                lower.contains("invalid") ||
                lower.contains("cannot") ||
                lower.contains("no such") ||
                lower.contains("permission denied") ||
                lower.contains("unrecognized option") ||
                lower.contains("unable to") ||
                (lower.contains("stream map") && lower.contains("matches no streams")) ||
                lower.contains("operation not permitted") ||
                lower.contains("input/output error") ||
                (lower.contains("error") && (lower.contains("parsing") || lower.contains("opening")));
    }

    private boolean isProgressLine(String line) {
        if (line == null) return false;
        return line.contains("size=") && line.contains("time=") &&
                line.contains("bitrate=") && (line.contains("speed=") || line.contains("speed=N/A"));
    }

    private boolean isHeaderLine(String line) {
        if (line == null) return false;
        return line.contains("ffmpeg version") || line.contains("built with") ||
                line.contains("configuration:") || line.contains("libavutil") ||
                line.contains("libavcodec") || line.contains("libavformat") ||
                line.contains("libavdevice") || line.contains("libavfilter") ||
                line.contains("libswscale") || line.contains("libswresample") ||
                line.contains("libpostproc");
    }

    private boolean isStreamInfoLine(String line) {
        if (line == null) return false;
        return line.contains("Stream #") || line.contains("Duration:") ||
                line.contains("Metadata:") || line.contains("BPS") ||
                line.contains("NUMBER_OF") || line.contains("_STATISTICS_") ||
                (line.contains("Video:") && line.contains("Audio:")) ||
                line.contains("Subtitle:");
    }

    private boolean isMappingLine(String line) {
        if (line == null) return false;
        return line.contains("Stream mapping:") || line.contains("-> #") ||
                line.contains("(copy)") || line.contains("Press [q] to stop");
    }

    private boolean isOutputLine(String line) {
        if (line == null) return false;
        return line.contains("Output #") ||
                (line.contains("encoder") && line.contains("Lavf")) ||
                line.contains("muxing overhead");
    }

    private boolean isWarningLine(String line) {
        if (line == null) return false;
        String lower = line.toLowerCase();
        return lower.contains("warning") || lower.contains("deprecated") ||
                lower.contains("experimental") || lower.contains("non monotonically");
    }
}
