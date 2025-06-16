package com.db.dbworld.payloads.user;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.Date;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class UserCinemaDataDto {

    private Long id;

    private String user;

    private String event;

    private String value;

    private Date time;

}
