package com.db.dbworld.app.media.aria2.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class Aria2WebSocketResponse {
    private String        jsonrpc = "2.0";
    private String        id;
    private Aria2StatusParam result;
    private Aria2RpcError error;
}
