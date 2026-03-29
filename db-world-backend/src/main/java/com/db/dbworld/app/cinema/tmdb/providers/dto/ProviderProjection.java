package com.db.dbworld.app.cinema.tmdb.providers.dto;

import com.db.dbworld.app.cinema.tmdb.enums.ProviderType;

public interface ProviderProjection {

    Long getTmdbId();

    Long getTmdbProviderId();

    Long getProviderId();

    String getProviderName();

    String getLogoPath();

    ProviderType getProviderType();

    Integer getDisplayPriority();

}
