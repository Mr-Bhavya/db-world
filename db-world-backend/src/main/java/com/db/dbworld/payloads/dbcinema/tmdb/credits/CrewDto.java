package com.db.dbworld.payloads.dbcinema.tmdb.credits;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CrewDto extends CreditDetailsDto{
    private String department;
    private String job;
}
