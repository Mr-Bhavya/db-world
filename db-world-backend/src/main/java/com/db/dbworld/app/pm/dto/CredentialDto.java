package com.db.dbworld.app.pm.dto;

import com.db.dbworld.app.pm.entity.CredentialType;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
public class CredentialDto {
    private String id;
    private String name;
    private CredentialType type;
    private String url;
    private String username;
    private String password;
    private String pin;
    private String notes;
    // Set only on entries read from the Trash (when they were trashed); null on live ones. Never
    // taken from a request: the mapper ignores it when writing to an entity.
    private Instant deletedAt;
    private List<CustomFieldDto> customFields = new ArrayList<>();
}
