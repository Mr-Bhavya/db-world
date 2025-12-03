package com.db.dbworld.services.aria2.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class Aria2WebSocketResponse {
    private String jsonrpc = "2.0";
    private String id;
//    private List<Aria2StatusParam> params;
    private Aria2StatusParam result;
    private Aria2RpcError error;
}
