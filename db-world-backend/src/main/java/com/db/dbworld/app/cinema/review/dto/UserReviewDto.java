package com.db.dbworld.app.cinema.review.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Getter;

import java.time.Instant;

@Getter
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class UserReviewDto {

    private String  id;
    private Long    userId;
    private Long    recordId;
    private String  username;
    private int     rating;
    private String  content;
    private Instant createdAt;
    private Instant updatedAt;

    /** True when the authenticated caller owns this review. */
    private Boolean ownReview;
}
