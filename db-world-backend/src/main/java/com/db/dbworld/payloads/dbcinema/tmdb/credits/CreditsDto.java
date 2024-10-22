package com.db.dbworld.payloads.dbcinema.tmdb.credits;

import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class CreditsDto {
    private List<CastDto> cast;
    private List<CrewDto> crew;
}
