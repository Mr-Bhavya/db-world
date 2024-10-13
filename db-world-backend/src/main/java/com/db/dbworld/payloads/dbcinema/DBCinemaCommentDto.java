package com.db.dbworld.payloads.dbcinema;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class DBCinemaCommentDto {

    private String commentId;
    private String userId;
    private String cinemaRecordId;
    private String comment;
    private String commentTime;

}
