package com.db.dbworld.app.cinema.review.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class UserReviewRequest {

    @NotNull
    @Min(1) @Max(10)
    private Integer rating;

    private String content;
}
