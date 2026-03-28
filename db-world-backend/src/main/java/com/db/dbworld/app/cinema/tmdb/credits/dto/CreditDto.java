package com.db.dbworld.app.cinema.tmdb.credits.dto;

import com.db.dbworld.cinema.tmdb.entities.TmdbEntity;
import com.db.dbworld.cinema.tmdb.enums.CreditType;
import com.db.dbworld.cinema.tmdb.people.dto.PersonDto;
import com.db.dbworld.cinema.tmdb.people.entity.PersonEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CreditDto {

    private PersonDto person;

    private CreditType creditType;

    private String department;

    private String job;

    private String character;

    private Integer castOrder;

    private String creditId;

}