package com.db.dbworld.services.aria2.model;

import lombok.Data;
import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class Aria2Uri {
    private String uri;
    private String status;
}

