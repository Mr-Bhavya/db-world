package com.db.dbworld.payloads.user;

import lombok.Getter;
import lombok.Setter;

import java.util.Date;

@Getter
@Setter
public class UserCinemaDataDto {

    private Long id;

    private String user;

    private String download_file;

    private String stream_file;

    private String search_keyword;

    private Date time;

}
