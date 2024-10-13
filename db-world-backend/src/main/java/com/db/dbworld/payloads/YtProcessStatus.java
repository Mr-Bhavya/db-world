package com.db.dbworld.payloads;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class YtProcessStatus {
    private String filename;
    private String status;
    private long downloaded_bytes;
    private long total_bytes;
    private double speed;
    private double elapsed;
    private double eta;
}