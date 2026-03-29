package com.db.dbworld.app.pm.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CredentialDto {
    private String id;
    private String username;
    private String password;
    private String pin;
    private String notes;
}
