package com.db.dbworld.services.aria2.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class Aria2BittorrentInfo {
    private String name;
    private Long pieceLength;
    private Long pieces;
    private Boolean privateTracker;
}
