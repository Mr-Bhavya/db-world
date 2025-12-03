package com.db.dbworld.services.aria2.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class Aria2File {
    private Long index;
    private String path;
    private Long length;
    private Long completedLength;
    private Boolean selected;
    private List<Aria2Uri> uris;
}
