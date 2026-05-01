package com.db.dbworld.events;

import org.springframework.context.ApplicationEvent;

public class DownloadStatusUpdateEvent extends ApplicationEvent {
    public DownloadStatusUpdateEvent(Object source) {
        super(source);
    }
}
