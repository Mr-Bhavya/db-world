package com.db.dbworld.app.media.aria2.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Parameters for an aria2.tellStatus RPC call.
 */
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Aria2StatusRequestParams {
    private String       gid;
    private List<String> keys;
}
