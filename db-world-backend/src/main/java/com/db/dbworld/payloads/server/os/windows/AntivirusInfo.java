package com.db.dbworld.payloads.server.os.windows;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class AntivirusInfo {
    private String name;
    private String vendor;
    private Boolean enabled;
    private String version;
    private String lastUpdate;
    private String productState;
}
