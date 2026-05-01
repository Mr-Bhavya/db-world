package com.db.dbworld.services.aria2.model;

import lombok.Data;
import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class WebSocketMessageContext {
    private String rawMessage;
    private Aria2WebSocketResponse response;
    private Aria2WebSocketNotification notification;
    private String messageType; // "response", "notification", "unknown"
    private Exception processingError;

    public boolean hasError() {
        return processingError != null ||
                (response != null && response.getError() != null);
    }

    public String getErrorMessage() {
        if (processingError != null) {
            return processingError.getMessage();
        }
        if (response != null && response.getError() != null) {
            return response.getError().getMessage();
        }
        return null;
    }
}