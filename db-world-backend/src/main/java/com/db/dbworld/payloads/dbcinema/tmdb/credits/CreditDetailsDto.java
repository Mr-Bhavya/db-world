package com.db.dbworld.payloads.dbcinema.tmdb.credits;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CreditDetailsDto {
    private Long id;
    private boolean adult;
    private long gender;
    private String known_for_department;
    private String name;
    private String original_name;
    private double popularity;
    private String profile_path;
    private String credit_id;
}
