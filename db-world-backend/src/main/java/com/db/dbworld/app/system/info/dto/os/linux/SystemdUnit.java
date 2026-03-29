package com.db.dbworld.app.system.info.dto.os.linux;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class SystemdUnit {
    private String name;
    private String loadState;
    private String activeState;
    private String subState;
    private String description;
    private String mainPid;
    private Long memoryCurrent;
}
