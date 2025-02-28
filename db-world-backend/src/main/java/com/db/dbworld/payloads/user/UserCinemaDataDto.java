package com.db.dbworld.payloads.user;

import lombok.Getter;
import lombok.Setter;

import java.util.Date;

@Getter
@Setter
public class UserCinemaDataDto {

    private Long id;

    private String user;

    private String event;

    private String value;

    private Date time;

}
