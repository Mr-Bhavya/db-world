package com.db.dbworld.app.system.info.dto.os.windows;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class FirewallProfile {
    private String name;
    private Boolean enabled;
    private String defaultInboundAction;
    private String defaultOutboundAction;
}
