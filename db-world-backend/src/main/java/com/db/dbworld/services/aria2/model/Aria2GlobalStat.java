package com.db.dbworld.services.aria2.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class Aria2GlobalStat {
    private Long downloadSpeed;
    private Long uploadSpeed;
    private Integer numActive;
    private Integer numWaiting;
    private Integer numStopped;
    private Integer numStoppedTotal;
}
