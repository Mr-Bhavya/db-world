package com.db.dbworld.app.cinema.tmdb.genre.entity;

import jakarta.persistence.*;
import lombok.*;

@Getter
@Setter
@Entity
@AllArgsConstructor
@NoArgsConstructor
@Table(name = "genres", schema = "new_db_world")
public class GenreEntity {

    @Id
    private Long id;   // TMDB genre id

    private String name;

}
