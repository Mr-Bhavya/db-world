package com.db.dbworld.app.media.aria2.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class Aria2Bittorrent {
    private String infoHash;
    private String name;
    private List<List<String>> announceList;
    private Aria2BittorrentInfo info;
    private String comment;
    private Long creationDate;
    private String mode;
    private List<Aria2BittorrentFile> bittorrentFiles;
}
