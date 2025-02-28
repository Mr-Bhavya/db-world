package com.db.dbworld.payloads.dbcinema.stream;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class MenuInfo extends TrackInfo {
    private Map<String, String> extra;
}
