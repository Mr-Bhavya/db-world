package com.db.dbworld.app.media.aria2.model;

import lombok.Getter;
import lombok.Setter;

/**
 * Transient context built while processing a single WebSocket text frame.
 */
@Getter
@Setter
public class WebSocketMessageContext {

    private String                   rawMessage;
    private Aria2WebSocketResponse   response;
    private Aria2WebSocketNotification notification;
    private String                   messageType; // "response" | "notification" | "unknown"
    private Exception                processingError;

    public boolean hasError() {
        return processingError != null
                || (response != null && response.getError() != null);
    }

    public String getErrorMessage() {
        if (processingError != null) return processingError.getMessage();
        if (response != null && response.getError() != null) return response.getError().getMessage();
        return null;
    }

    public void setProcessingError(Exception e) {
        this.processingError = e;
        this.messageType = "error";
    }
}
