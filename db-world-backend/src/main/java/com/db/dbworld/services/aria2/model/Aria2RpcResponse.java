package com.db.dbworld.services.aria2.model;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class Aria2RpcResponse {
    private String jsonrpc = "2.0";
    private String id;
    private JsonNode result;
    private Aria2RpcError error;
}
