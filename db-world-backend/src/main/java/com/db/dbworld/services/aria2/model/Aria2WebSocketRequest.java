package com.db.dbworld.services.aria2.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class Aria2WebSocketRequest {
    private String jsonrpc = "2.0";
    private String id;
    private String method;
    private List<Object> params;
}
