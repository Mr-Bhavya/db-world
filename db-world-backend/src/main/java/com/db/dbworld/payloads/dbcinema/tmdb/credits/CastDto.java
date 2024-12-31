package com.db.dbworld.payloads.dbcinema.tmdb.credits;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CastDto extends PersonDto{
//    private Long id;
    private Long cast_id;
    private String character;
    private Long order;
}
