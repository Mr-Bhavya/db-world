package com.db.dbworld.payloads.user;

import com.db.dbworld.core.user.dto.UserDto;
import lombok.Getter;
import lombok.Setter;

import java.util.Date;

@Getter
@Setter
public class LoginDataDto {
    private int id;

    private UserDto userDto;

    private Date lastLoginDate;

    private String loginAgent;
}
