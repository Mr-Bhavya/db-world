package com.db.dbworld.payloads.server;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

/** @deprecated Use {@link com.db.dbworld.app.system.info.dto.BiosInfo} instead. */
@Deprecated(forRemoval = true)
@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class BiosInfo {
    private String vendor;
    private String version;
    private String releaseDate;
    private String firmwareRevision;
}
