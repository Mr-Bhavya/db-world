package com.db.dbworld.app.system.info.dto.os.linux;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

import java.util.List;

@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class UserInfo {
    private String username;
    private String uid;
    private String gid;
    private String home;
    private String shell;
    private List<String> groups;
    private Long lastLogin;
    private Boolean locked;
    private Boolean passwordExpired;
    private String realName;
}
