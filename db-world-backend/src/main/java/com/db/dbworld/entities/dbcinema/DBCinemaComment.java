package com.db.dbworld.entities.dbcinema;

import lombok.Getter;
import lombok.Setter;
import org.springframework.data.mongodb.core.mapping.Document;

@Getter
@Setter
@Document("DB_CINEMA_COMMENTS")
public class DBCinemaComment {

    private String commentId;
    private String userId;
    private String dbCinemaRecordId;
    private String comment;
    private String commentTime;

}
