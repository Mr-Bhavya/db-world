package com.db.dbworld.core.exception;

import lombok.Getter;

import java.io.IOException;

/**
 * Exception thrown when a process execution fails.
 * This exception captures detailed information about the failed process execution,
 * including exit codes, timeouts, and other execution-related errors.
 */
@Getter
public class ProcessExecutionException extends Exception {

    /**
     * -- GETTER --
     *  Returns the exit code of the process, if available.
     *
     * @return the exit code, or null if not available
     */
    private final Integer exitCode;
    /**
     * -- GETTER --
     *  Returns the command that was executed.
     *
     * @return the command, or null if not available
     */
    private final String command;
    /**
     * -- GETTER --
     *  Returns whether the process timed out.
     *
     * @return true if the process timed out, false otherwise
     */
    private final boolean timedOut;
    /**
     * -- GETTER --
     *  Returns whether the process was cancelled.
     *
     * @return true if the process was cancelled, false otherwise
     */
    private final boolean cancelled;

    /**
     * Constructs a new ProcessExecutionException with the specified detail message.
     *
     * @param message the detail message
     */
    public ProcessExecutionException(String message) {
        super(message);
        this.exitCode = null;
        this.command = null;
        this.timedOut = false;
        this.cancelled = false;
    }

    /**
     * Constructs a new ProcessExecutionException with the specified detail message and cause.
     *
     * @param message the detail message
     * @param cause the cause of the exception
     */
    public ProcessExecutionException(String message, Throwable cause) {
        super(message, cause);
        this.exitCode = null;
        this.command = null;
        this.timedOut = false;
        this.cancelled = false;
    }

    /**
     * Constructs a new ProcessExecutionException with detailed execution information.
     *
     * @param message the detail message
     * @param exitCode the exit code of the process, if available
     * @param command the command that was executed, if available
     * @param timedOut whether the process timed out
     * @param cancelled whether the process was cancelled
     */
    public ProcessExecutionException(String message, Integer exitCode, String command,
                                     boolean timedOut, boolean cancelled) {
        super(message);
        this.exitCode = exitCode;
        this.command = command;
        this.timedOut = timedOut;
        this.cancelled = cancelled;
    }

    /**
     * Constructs a new ProcessExecutionException with detailed execution information and cause.
     *
     * @param message the detail message
     * @param cause the cause of the exception
     * @param exitCode the exit code of the process, if available
     * @param command the command that was executed, if available
     * @param timedOut whether the process timed out
     * @param cancelled whether the process was cancelled
     */
    public ProcessExecutionException(String message, Throwable cause, Integer exitCode,
                                     String command, boolean timedOut, boolean cancelled) {
        super(message, cause);
        this.exitCode = exitCode;
        this.command = command;
        this.timedOut = timedOut;
        this.cancelled = cancelled;
    }

    /**
     * Creates a ProcessExecutionException for a non-zero exit code.
     *
     * @param exitCode the non-zero exit code
     * @param command the command that was executed
     * @return a new ProcessExecutionException
     */
    public static ProcessExecutionException forExitCode(int exitCode, String command) {
        String message = String.format("Process failed with exit code %d: %s", exitCode, command);
        return new ProcessExecutionException(message, exitCode, command, false, false);
    }

    /**
     * Creates a ProcessExecutionException for a timeout.
     *
     * @param command the command that timed out
     * @param timeout the timeout duration
     * @return a new ProcessExecutionException
     */
    public static ProcessExecutionException forTimeout(String command, String timeout) {
        String message = String.format("Process timed out after %s: %s", timeout, command);
        return new ProcessExecutionException(message, null, command, true, false);
    }

    /**
     * Creates a ProcessExecutionException for a cancelled process.
     *
     * @param command the command that was cancelled
     * @return a new ProcessExecutionException
     */
    public static ProcessExecutionException forCancellation(String command) {
        String message = String.format("Process was cancelled: %s", command);
        return new ProcessExecutionException(message, null, command, false, true);
    }

    /**
     * Creates a ProcessExecutionException for an I/O error.
     *
     * @param command the command that failed
     * @param cause the I/O exception
     * @return a new ProcessExecutionException
     */
    public static ProcessExecutionException forIOException(String command, IOException cause) {
        String message = String.format("I/O error executing command: %s - %s", command, cause.getMessage());
        return new ProcessExecutionException(message, cause, null, command, false, false);
    }

    /**
     * Creates a ProcessExecutionException for an interrupted process.
     *
     * @param command the command that was interrupted
     * @return a new ProcessExecutionException
     */
    public static ProcessExecutionException forInterruption(String command) {
        String message = String.format("Process was interrupted: %s", command);
        return new ProcessExecutionException(message, null, command, false, true);
    }

    /**
     * Returns a detailed message including execution information.
     *
     * @return a detailed exception message
     */
    @Override
    public String getMessage() {
        String baseMessage = super.getMessage();

        StringBuilder sb = new StringBuilder();
        if (baseMessage != null) {
            sb.append(baseMessage);
        }

        if (exitCode != null) {
            sb.append(" [Exit Code: ").append(exitCode).append("]");
        }

        if (timedOut) {
            sb.append(" [Timed Out]");
        }

        if (cancelled) {
            sb.append(" [Cancelled]");
        }

        if (command != null) {
            sb.append(" [Command: ").append(command).append("]");
        }

        return sb.toString();
    }

    /**
     * Returns a brief description of this exception suitable for logging.
     *
     * @return a brief description
     */
    public String getBriefDescription() {
        if (timedOut) {
            return "Process timeout";
        } else if (cancelled) {
            return "Process cancelled";
        } else if (exitCode != null) {
            return String.format("Process failed with exit code %d", exitCode);
        } else {
            return "Process execution failed";
        }
    }

    /**
     * Checks if this exception was caused by a non-zero exit code.
     *
     * @return true if caused by a non-zero exit code, false otherwise
     */
    public boolean isExitCodeFailure() {
        return exitCode != null && exitCode != 0;
    }

    /**
     * Checks if this exception was caused by user cancellation.
     *
     * @return true if caused by user cancellation, false otherwise
     */
    public boolean isUserCancelled() {
        return cancelled && !timedOut;
    }
}