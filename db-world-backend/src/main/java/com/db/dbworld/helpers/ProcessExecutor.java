package com.db.dbworld.helpers;

import com.db.dbworld.exceptions.ProcessExecutionException;
import com.db.dbworld.stream.processor.StreamProcessor;
import com.db.dbworld.utils.DbWorldRuntimeProperties;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Component;

import java.io.*;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Consumer;
import java.util.function.Predicate;

@Log4j2
@Component
public class ProcessExecutor implements AutoCloseable {

    /** Virtual threads for blocking IO */
    private final ExecutorService ioExecutor = Executors.newVirtualThreadPerTaskExecutor();

    /** Virtual-thread scheduler for timeout & cancellation */
    private final ScheduledExecutorService scheduler =
            Executors.newSingleThreadScheduledExecutor(
                    Thread.ofVirtual().name("process-scheduler-", 0).factory()
            );

    private final DbWorldRuntimeProperties runtimeProperties;

    public ProcessExecutor(DbWorldRuntimeProperties runtimeProperties) {
        this.runtimeProperties = runtimeProperties;
    }

    /* --------------------------------------------------- */
    /* Core execution                                      */
    /* --------------------------------------------------- */

    public ProcessResult execute(ProcessConfiguration config) throws ProcessExecutionException {
        validateConfiguration(config);

        Process process = null;
        ScheduledFuture<?> timeoutTask = null;
        ScheduledFuture<?> cancellationTask = null;

        AtomicBoolean timedOut = new AtomicBoolean(false);

        try {
            ProcessBuilder pb = createProcessBuilder(config);
            log.debug("Starting process: {}", String.join(" ", config.command()));

            process = pb.start();
            ProcessHandle handle = process.toHandle();

            CompletableFuture<Void> stdout =
                    consumeStream(process.getInputStream(), config.outputProcessor());
            CompletableFuture<Void> stderr =
                    consumeStream(process.getErrorStream(), config.errorProcessor());

            final Process finalProcess = process;

            /* ---------- Cancellation ---------- */
            if (config.cancellationFlag() != null) {
                cancellationTask = scheduler.scheduleAtFixedRate(() -> {
                    if (finalProcess.isAlive() && config.cancellationFlag().get()) {
                        log.debug("Cancellation requested → terminating process");
                        destroyProcess(finalProcess, handle, config.onTimeout());
                    }
                }, 0, 300, TimeUnit.MILLISECONDS);
            }

            /* ---------- Timeout ---------- */
            if (config.timeout() != null && !config.timeout().isZero()) {
                timeoutTask = scheduler.schedule(() -> {
                    if (finalProcess.isAlive()) {
                        timedOut.set(true);
                        log.warn("Process timed out → {}", config.timeout());
                        destroyProcess(finalProcess, handle, config.onTimeout());
                    }
                }, config.timeout().toMillis(), TimeUnit.MILLISECONDS);
            }

            int exitCode = process.waitFor();

            stdout.join();
            stderr.join();

            if (timedOut.get()) {
                return new ProcessResult(exitCode, false, true, false);
            }

            boolean success = config.successPredicate().test(exitCode);
            return new ProcessResult(exitCode, success, false, false);

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            destroyProcess(process);
            return new ProcessResult(-1, false, false, true);

        } catch (IOException e) {
            destroyProcess(process);
            throw ProcessExecutionException.forIOException(
                    String.join(" ", config.command()), e
            );

        } finally {
            if (timeoutTask != null) timeoutTask.cancel(true);
            if (cancellationTask != null) cancellationTask.cancel(true);
            closeProcessStreams(process);
        }
    }

    /* --------------------------------------------------- */
    /* FFmpeg command execution                            */
    /* --------------------------------------------------- */

    public void executeFfmpegCommand(
            List<String> command,
            StreamProcessor streamProcessor,
            AtomicBoolean cancellationFlag
    ) throws ProcessExecutionException {

        List<String> fullCommand = new ArrayList<>();

        if (command.isEmpty() ||
                (!command.get(0).equals("ffmpeg") && !command.get(0).equals(runtimeProperties.getFfmpeg()))) {
            fullCommand.add(runtimeProperties.getFfmpeg());
        }

        fullCommand.addAll(command);

        String commandString = String.join(" ", fullCommand);
        log.info("FFmpeg command: {}", commandString);

        long startTime = System.currentTimeMillis();

        // Handle null stream processor
        Consumer<String> stdoutProcessor = streamProcessor != null ?
                streamProcessor.stdoutConsumer() :
                line -> log.info("[FFmpeg stdout]: {}", line);

        Consumer<String> stderrProcessor = streamProcessor != null ?
                streamProcessor.stderrConsumer() :
                line -> log.error("[FFmpeg stderr]: {}", line);

        ProcessResult result = execute(
                ProcessConfiguration.builder()
                        .command(fullCommand.toArray(new String[0]))
                        .outputProcessor(stdoutProcessor)
                        .errorProcessor(stderrProcessor)
                        .cancellationFlag(cancellationFlag)
                        .timeout(Duration.ofHours(2))
                        .successPredicate(code -> code == 0)
                        .onTimeout(ProcessTimeoutAction.FORCE_TERMINATE)
                        .build()
        );

        long executionTime = System.currentTimeMillis() - startTime;

        if (!result.success()) {
            throw ProcessExecutionException.forExitCode(
                    result.exitCode(),
                    commandString
            );
        }

        log.info("FFmpeg completed successfully in {} ms", executionTime);

    }

    /* --------------------------------------------------- */
    /* Extraction convenience API                          */
    /* --------------------------------------------------- */

    public void executeExtraction(
            String archivePath,
            String outputPath,
            StreamProcessor streamProcessor,
            AtomicBoolean cancellationFlag,
            Duration timeout
    ) throws ProcessExecutionException {

        String[] command = {
                runtimeProperties.getSevenZip(), "x", "-bsp1", "-bb1",
                archivePath,
                "-o" + outputPath,
                "-aoa"
        };

        ProcessResult result = execute(
                ProcessConfiguration.builder()
                        .command(command)
                        .outputProcessor(streamProcessor.stdoutConsumer())
                        .errorProcessor(streamProcessor.stderrConsumer())
                        .cancellationFlag(cancellationFlag)
                        .timeout(timeout)
                        .successPredicate(code -> code == 0)
                        .build()
        );

        if (!result.success()) {
            throw ProcessExecutionException.forExitCode(
                    result.exitCode(),
                    String.join(" ", command)
            );
        }
    }

    /* --------------------------------------------------- */
    /* MediaInfo                                           */
    /* --------------------------------------------------- */

    public String runMediaInfoCommand(Path mediaPath) throws ProcessExecutionException {
        StringBuilder output = new StringBuilder();

        String[] command = {
                runtimeProperties.getMediaInfo(),
                "--output=JSON",
                mediaPath.toAbsolutePath().toString()
        };

        ProcessResult result = execute(
                ProcessConfiguration.builder()
                        .command(command)
                        .outputProcessor(output::append)
                        .errorProcessor(line ->
                                log.warn("MediaInfo stderr: {}", line))
                        .timeout(Duration.ofSeconds(30))
                        .successPredicate(code -> code == 0)
                        .build()
        );

        if (!result.success()) {
            throw ProcessExecutionException.forExitCode(
                    result.exitCode(),
                    String.join(" ", command)
            );
        }

        return output.toString();
    }

    /* --------------------------------------------------- */
    /* Helpers                                             */
    /* --------------------------------------------------- */

    private CompletableFuture<Void> consumeStream(
            InputStream stream,
            Consumer<String> processor
    ) {
        if (processor == null) {
            return CompletableFuture.completedFuture(null);
        }

        return CompletableFuture.runAsync(() -> {
            try (BufferedReader reader =
                         new BufferedReader(new InputStreamReader(stream))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    processor.accept(line);
                }
            } catch (IOException ignored) {
                // Stream closed, process terminated
            }
        }, ioExecutor);
    }

    private void destroyProcess(Process process) {
        if (process != null && process.isAlive()) {
            process.destroyForcibly();
        }
    }

    private void destroyProcess(
            Process process,
            ProcessHandle handle,
            ProcessTimeoutAction action
    ) {
        if (process == null || !process.isAlive()) return;

        switch (action) {
            case FORCE_TERMINATE -> handle.destroyForcibly();
            case TERMINATE -> process.destroy();
            case DO_NOTHING -> {}
        }
    }

    private void closeProcessStreams(Process process) {
        if (process == null) return;
        try {
            process.getInputStream().close();
            process.getErrorStream().close();
            process.getOutputStream().close();
        } catch (IOException ignored) {
            // Already closed or process terminated
        }
    }

    private ProcessBuilder createProcessBuilder(ProcessConfiguration config) {
        ProcessBuilder pb = new ProcessBuilder(config.command());

        if (config.environment() != null) {
            pb.environment().putAll(config.environment());
        }
        if (config.workingDirectory() != null) {
            pb.directory(new File(config.workingDirectory()));
        }

        // Redirect error stream if no separate error processor is provided
        if (config.errorProcessor() == null && config.outputProcessor() != null) {
            pb.redirectErrorStream(true);
        }

        return pb;
    }

    private void validateConfiguration(ProcessConfiguration config) {
        if (config.command() == null || config.command().length == 0) {
            throw new IllegalArgumentException("Command must not be empty");
        }
    }

    /* --------------------------------------------------- */
    /* Utility methods for backward compatibility          */
    /* --------------------------------------------------- */

    /**
     * Legacy method for executing FFmpeg with simple output collection
     * Maintains backward compatibility with existing code
     */
    public String executeFfmpegWithSimpleOutput(List<String> command)
            throws ProcessExecutionException {

        StringBuilder output = new StringBuilder();

        ProcessResult result = execute(
                ProcessConfiguration.builder()
                        .command(command.toArray(new String[0]))
                        .outputProcessor(output::append)
                        .errorProcessor(output::append)
                        .timeout(Duration.ofHours(1))
                        .successPredicate(code -> code == 0)
                        .build()
        );

        if (!result.success()) {
            throw ProcessExecutionException.forExitCode(
                    result.exitCode(),
                    String.join(" ", command)
            );
        }

        return output.toString();
    }

    /* --------------------------------------------------- */
    /* Shutdown                                            */
    /* --------------------------------------------------- */

    @Override
    public void close() {
        ioExecutor.shutdownNow();
        scheduler.shutdownNow();
    }

    /* --------------------------------------------------- */
    /* Records / enums                                     */
    /* --------------------------------------------------- */

    public record ProcessConfiguration(
            String[] command,
            Consumer<String> outputProcessor,
            Consumer<String> errorProcessor,
            AtomicBoolean cancellationFlag,
            Duration timeout,
            String workingDirectory,
            Map<String, String> environment,
            Predicate<Integer> successPredicate,
            ProcessTimeoutAction onTimeout
    ) {
        public static Builder builder() { return new Builder(); }

        public static class Builder {
            private String[] command;
            private Consumer<String> outputProcessor;
            private Consumer<String> errorProcessor;
            private AtomicBoolean cancellationFlag;
            private Duration timeout = Duration.ZERO;
            private String workingDirectory;
            private Map<String, String> environment;
            private Predicate<Integer> successPredicate = c -> c == 0;
            private ProcessTimeoutAction onTimeout = ProcessTimeoutAction.TERMINATE;

            public Builder command(String... cmd) { this.command = cmd; return this; }
            public Builder outputProcessor(Consumer<String> c) { this.outputProcessor = c; return this; }
            public Builder errorProcessor(Consumer<String> c) { this.errorProcessor = c; return this; }
            public Builder cancellationFlag(AtomicBoolean f) { this.cancellationFlag = f; return this; }
            public Builder timeout(Duration t) { this.timeout = t; return this; }
            public Builder workingDirectory(String d) { this.workingDirectory = d; return this; }
            public Builder environment(Map<String, String> e) { this.environment = e; return this; }
            public Builder successPredicate(Predicate<Integer> p) { this.successPredicate = p; return this; }
            public Builder onTimeout(ProcessTimeoutAction a) { this.onTimeout = a; return this; }

            public ProcessConfiguration build() {
                return new ProcessConfiguration(
                        command, outputProcessor, errorProcessor,
                        cancellationFlag, timeout,
                        workingDirectory, environment,
                        successPredicate, onTimeout
                );
            }
        }
    }

    public record ProcessResult(
            int exitCode,
            boolean success,
            boolean timedOut,
            boolean cancelled
    ) {}

    public enum ProcessTimeoutAction {
        TERMINATE,
        FORCE_TERMINATE,
        DO_NOTHING
    }
}