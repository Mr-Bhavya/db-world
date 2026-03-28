package com.db.dbworld.app.cinema.tmdb.client.dto;

import com.db.dbworld.cinema.tmdb.credits.dto.CreditDto;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class CreditsTmdbResponse {

    private Long id;

    private List<CreditTmdbResponse> cast;

    private List<CreditTmdbResponse> crew;

}