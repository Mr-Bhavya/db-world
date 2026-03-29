package com.db.dbworld.app.media.aria2.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class Aria2Version {
    private String       version;
    private List<String> enabledFeatures;
}
