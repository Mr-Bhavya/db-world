package com.db.dbworld.app.system.info.dto.os.windows;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class EventLogEntry {
    private String time;
    private String source;
    private String eventId;
    private String level;
    private String message;
    private String user;
    private String computer;
    private String category;
}
