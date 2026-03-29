package com.db.dbworld.services.mirror.ytdlp;

import com.db.dbworld.core.exception.ProcessExecutionException;
import com.db.dbworld.helpers.ProcessExecutor;
import com.db.dbworld.payloads.mirror.ytdlp.YoutubeDownloadRequest;
import com.db.dbworld.utils.DbWorldRuntimeProperties;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

/**
 * @deprecated Superseded by {@link com.db.dbworld.app.media.ingestion.download.YtDlpDownloadStrategy}.
 */
@Deprecated(forRemoval = true)
@Log4j2
@Service
public class YoutubeDownloadServiceImpl implements YoutubeDownloadService {

    private final ProcessExecutor processExecutor;
    private final DbWorldRuntimeProperties runtimeProperties;

    @Autowired
    public YoutubeDownloadServiceImpl(ProcessExecutor processExecutor,
                                      DbWorldRuntimeProperties runtimeProperties) {
        this.processExecutor = processExecutor;
        this.runtimeProperties = runtimeProperties;
    }

    @Override
    public String executeYtDownload(YoutubeDownloadRequest request) throws ProcessExecutionException {
        List<String> command = buildYtDlpCommand(request);
        String commandString = String.join(" ", command);
        log.info("Executing yt-dlp command: {}", commandString);

        ProcessExecutor.ProcessResult result = processExecutor.execute(
                ProcessExecutor.ProcessConfiguration.builder()
                        .command(command.toArray(new String[0]))
                        .outputProcessor(request.getOutputProcessor())
                        .errorProcessor(request.getErrorProcessor())
                        .cancellationFlag(request.getCancellationFlag())
                        .timeout(request.getTimeout())
                        .successPredicate(code -> code == 0 || code == 1) // yt-dlp specific
                        .build()
        );

        if (!result.success()) {
            // Check different failure scenarios
            if (result.timedOut()) {
                String timeoutStr = request.getTimeout() != null ?
                        request.getTimeout().toString() : "unknown";
                throw ProcessExecutionException.forTimeout(commandString, timeoutStr);
            } else if (result.cancelled()) {
                throw ProcessExecutionException.forCancellation(commandString);
            } else {
                // Non-zero exit code
                throw ProcessExecutionException.forExitCode(
                        result.exitCode(),
                        commandString
                );
            }
        }

        return getDownloadedFilename(request);
    }

    @Override
    public String getYoutubeVideoInfo(String videoUrl) throws ProcessExecutionException {
        List<String> command = buildInfoCommand(videoUrl);
        String commandString = String.join(" ", command);

        StringBuilder output = new StringBuilder();

        ProcessExecutor.ProcessResult result = processExecutor.execute(
                ProcessExecutor.ProcessConfiguration.builder()
                        .command(command.toArray(new String[0]))
                        .outputProcessor(output::append)
                        .timeout(Duration.ofSeconds(60))
                        .successPredicate(code -> code == 0)
                        .build()
        );

        if (!result.success()) {
            if (result.timedOut()) {
                throw ProcessExecutionException.forTimeout(commandString, "60 seconds");
            } else {
                throw ProcessExecutionException.forExitCode(
                        result.exitCode(),
                        commandString
                );
            }
        }

        return output.toString();
    }

    @Override
    public String getDownloadedFilename(YoutubeDownloadRequest request) throws ProcessExecutionException {
        List<String> command = buildFilenameCommand(request);
        String commandString = String.join(" ", command);

        StringBuilder output = new StringBuilder();

        ProcessExecutor.ProcessResult result = processExecutor.execute(
                ProcessExecutor.ProcessConfiguration.builder()
                        .command(command.toArray(new String[0]))
                        .outputProcessor(output::append)
                        .timeout(Duration.ofSeconds(30))
                        .successPredicate(code -> code == 0)
                        .build()
        );

        if (!result.success()) {
            if (result.timedOut()) {
                throw ProcessExecutionException.forTimeout(commandString, "30 seconds");
            } else {
                throw ProcessExecutionException.forExitCode(
                        result.exitCode(),
                        commandString
                );
            }
        }

        return output.toString().trim();
    }

    // Helper methods (buildYtDlpCommand, buildInfoCommand, buildFilenameCommand, etc.)
    // ... these remain the same as before

    private List<String> buildYtDlpCommand(YoutubeDownloadRequest request) {
        List<String> command = new ArrayList<>();

        command.add(getYtDlpPath());

        // Add cookies if needed
        if (requiresCookies(request.getVideoUrl())) {
            command.addAll(List.of("--cookies", getCookiesPath()));
        }

        // Add format selector
        command.addAll(List.of("-f", buildFormatSelector(
                request.getVideoITag(),
                request.getAudioITag()
        )));

        // Add output template
        command.addAll(List.of("-o", request.getOutputPath() + ".%(ext)s"));

        // Add progress template
        command.addAll(List.of("--progress-template", "%(progress)j"));

        // Add video URL
        command.add(request.getVideoUrl());

        return command;
    }

    private List<String> buildInfoCommand(String videoUrl) {
        List<String> command = new ArrayList<>();
        command.add(getYtDlpPath());
        command.add("-J"); // JSON output

        // Add cookies if needed
        if (requiresCookies(videoUrl)) {
            command.addAll(List.of("--cookies", getCookiesPath()));
        }

        command.add(videoUrl);
        return command;
    }

    private List<String> buildFilenameCommand(YoutubeDownloadRequest request) {
        List<String> command = new ArrayList<>();
        command.add(getYtDlpPath());
        command.add("-f");
        command.add(buildFormatSelector(request.getVideoITag(), request.getAudioITag()));
        command.add("--print");
        command.add("filename");

        // Add cookies if needed
        if (requiresCookies(request.getVideoUrl())) {
            command.addAll(List.of("--cookies", getCookiesPath()));
        }

        command.add(request.getVideoUrl());
        return command;
    }

    private String buildFormatSelector(String videoITag, String audioITag) {
        // Business logic for format selection
        if (videoITag == null || videoITag.isEmpty()) {
            return audioITag == null || audioITag.isEmpty() || "0".equals(audioITag)
                    ? "bestaudio/best"
                    : audioITag;
        }

        String videoFormat = "best".equals(videoITag) ? "bestvideo" : videoITag;

        if (audioITag == null || audioITag.isEmpty()) {
            return videoFormat;
        } else if ("0".equals(audioITag)) {
            return videoFormat; // Video only
        } else {
            return videoFormat + "+" + audioITag + "/best";
        }
    }

    private String getYtDlpPath() {
        return runtimeProperties.getYtDlp() != null ?
                runtimeProperties.getYtDlp() : "yt-dlp";
    }

    private String getCookiesPath() {
        return "runtimeProperties.getCookiesPath()";
    }

    private boolean requiresCookies(String videoUrl) {
        return videoUrl != null &&
                (videoUrl.contains("hotstar.com") ||
                        videoUrl.contains("netflix.com") ||
                        "runtimeProperties.getCookiesPath()" != null);
    }
}