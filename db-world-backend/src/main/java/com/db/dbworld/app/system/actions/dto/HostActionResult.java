package com.db.dbworld.app.system.actions.dto;

import java.util.Map;

/**
 * One action as the admin UI sees it: a request still waiting in the queue, or what the host
 * wrote about it once it was picked up.
 *
 * <p>The list endpoint leaves {@code output} and {@code data} out ({@code hasOutput} says whether
 * there is any) because it is polled every few seconds while something runs, and fifty results
 * of two hundred lines each is a lot to send a phone that often. The single-action endpoint
 * returns both.
 *
 * @param id          lowercase UUID; also the file name
 * @param action      wire name, e.g. {@code backup-start}
 * @param args        the arguments as requested
 * @param requestedBy the admin who asked
 * @param requestedAt ISO-8601 with the offset it was written with
 * @param status      queued | running | done | failed | rejected, or unknown for a result the
 *                    host wrote with something else
 * @param message     one line for people; for a queued request, how long it has been waiting
 * @param startedAt   ISO-8601, null until picked up
 * @param finishedAt  ISO-8601, null until finished
 * @param exitCode    the action's exit code, null until finished
 * @param output      last ~200 lines, ANSI stripped; null in the list
 * @param data        action-specific result (the cleanup preview); null in the list and for most actions
 * @param hasOutput   the result has output to fetch
 */
public record HostActionResult(
        String id,
        String action,
        Map<String, Object> args,
        String requestedBy,
        String requestedAt,
        String status,
        String message,
        String startedAt,
        String finishedAt,
        Integer exitCode,
        String output,
        Object data,
        boolean hasOutput
) {

    /** The same result without the bulky fields, for the list. */
    public HostActionResult summary() {
        return new HostActionResult(id, action, args, requestedBy, requestedAt, status, message,
                startedAt, finishedAt, exitCode, null, null, hasOutput);
    }
}
