package com.db.dbworld.app.system.actions.dto;

/**
 * The answer to a submit: the request is in the queue, not yet run. The UI polls
 * {@code GET /api/server/host-actions/{id}} for what happened to it.
 *
 * @param id     the request id, a lowercase UUID
 * @param status always {@code queued}
 */
public record HostActionSubmitted(String id, String status) {

    public static HostActionSubmitted queued(String id) {
        return new HostActionSubmitted(id, "queued");
    }
}
