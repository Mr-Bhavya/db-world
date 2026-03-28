package com.db.dbworld.app.cinema.tmdb.providers.dto;

import com.db.dbworld.cinema.tmdb.entities.TmdbEntity;
import com.db.dbworld.cinema.tmdb.enums.ProviderType;
import com.db.dbworld.cinema.tmdb.providers.entity.ProviderEntity;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class TmdbProviderDto {

    private Long id;

    private ProviderDto provider;

    private ProviderType providerType;

    private String regionCode;

}