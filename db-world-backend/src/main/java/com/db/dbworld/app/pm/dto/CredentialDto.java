package com.db.dbworld.app.pm.dto;

import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
public class CredentialDto {
    private String id;
    private String username;
    private String password;
    private String pin;
    private String notes;
    private List<CustomFieldDto> customFields = new ArrayList<>();
}
