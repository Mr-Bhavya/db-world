package com.db.dbworld.payloads.server.os.raspberrypi;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class PackageInfo {
    private String name;
    private String version;
    private String architecture;
    private String repository;
    private Long size;
    private String description;
    private String maintainer;
    private Long installDate;
    private String section;
}
