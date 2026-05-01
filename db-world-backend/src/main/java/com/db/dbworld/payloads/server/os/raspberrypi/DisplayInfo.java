package com.db.dbworld.payloads.server.os.raspberrypi;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class DisplayInfo {
    private Boolean displayConnected;
    private String displayType;
    private String displayResolution;
    private String displayOverscan;
    private String displayHdmiMode;
    private Boolean displayHdmiSafe;
    private Boolean displayCompositeEnabled;
}
