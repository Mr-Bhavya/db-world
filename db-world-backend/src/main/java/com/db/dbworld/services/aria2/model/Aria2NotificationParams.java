package com.db.dbworld.services.aria2.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class Aria2NotificationParams {
    private String gid;
    private Integer files;
    private Long totalLength;
    private Aria2Bittorrent bittorrent;
}
