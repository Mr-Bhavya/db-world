package com.db.dbworld.app.cinema.tmdb.providers.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class ProviderDto {

    private Long id;

    private String name;

    private String logoPath;

    private Integer displayPriority;

}