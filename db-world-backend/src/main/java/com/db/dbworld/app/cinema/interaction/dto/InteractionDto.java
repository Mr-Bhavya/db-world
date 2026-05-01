package com.db.dbworld.app.cinema.interaction.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class InteractionDto {

    private Long recordId;

    private boolean liked;
    private boolean loved;
    private boolean watchlisted;
    private boolean watched;

    private Integer progress; // optional
}