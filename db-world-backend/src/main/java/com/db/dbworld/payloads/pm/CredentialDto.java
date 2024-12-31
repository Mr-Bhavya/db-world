package com.db.dbworld.payloads.pm;

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
