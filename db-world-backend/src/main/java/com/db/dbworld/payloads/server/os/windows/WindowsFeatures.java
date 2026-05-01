package com.db.dbworld.payloads.server.os.windows;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

import java.util.List;

@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class WindowsFeatures {
    private List<String> enabledFeatures;
    private List<String> disabledFeatures;
    private List<String> optionalFeatures;
    private List<String> serverRoles;
    private Boolean hyperVEnabled;
    private Boolean wslEnabled;
    private Boolean iisEnabled;
    private Boolean netFrameworkEnabled;
}
