package com.db.dbworld.app.system.info.dto.os.linux;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class CronJob {
    private String user;
    private String schedule;
    private String command;
    private String comment;
    private String environment;
}
