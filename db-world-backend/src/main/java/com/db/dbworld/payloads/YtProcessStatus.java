package com.db.dbworld.payloads;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class YtProcessStatus {
    private String filename;
    private String status;
    private Long downloaded_bytes;
    private Long total_bytes;
    private double speed;
    private double elapsed;
    private double eta;
}