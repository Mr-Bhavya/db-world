package com.db.dbworld.app.media.aria2.model;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class Aria2RpcError {
    private Integer  code;
    private String   message;
    private JsonNode data;
}
