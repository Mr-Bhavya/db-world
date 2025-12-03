package com.db.dbworld.services.aria2.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class Aria2BittorrentFile {
    private Long index;
    private String path;
    private Long length;
    private Long completedLength;
    private Boolean selected;
}
