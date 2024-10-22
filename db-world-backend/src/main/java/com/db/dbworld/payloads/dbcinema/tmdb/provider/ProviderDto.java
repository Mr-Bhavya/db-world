package com.db.dbworld.payloads.dbcinema.tmdb.provider;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ProviderDto {
    private long provider_id;
    private String logo_path;
    private String provider_name;
}
