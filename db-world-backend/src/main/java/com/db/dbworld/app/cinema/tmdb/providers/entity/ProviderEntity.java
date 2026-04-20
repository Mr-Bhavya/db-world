package com.db.dbworld.app.cinema.tmdb.providers.entity;

import jakarta.persistence.*;
import lombok.*;

@Getter
@Setter
@Entity
@AllArgsConstructor
@NoArgsConstructor
@Table(name = "providers", schema = "new_db_world")
public class ProviderEntity {

    @Id
    private Long id;

    private String name;

    private String logoPath;

    private Integer displayPriority;

}