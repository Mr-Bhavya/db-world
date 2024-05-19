package com.db.dbworld.payloads;

import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;

@Getter
@Setter
public class Credential implements Serializable {

    private long id;
    private String username;
    private String password;
    private long pin;
    private String description;
}
