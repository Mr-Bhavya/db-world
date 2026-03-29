package com.db.dbworld.core.user.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.validation.constraints.*;
import lombok.*;

import java.io.Serializable;
import java.util.Date;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class CreateUserRequest {

    @NotEmpty
    @Size(min = 2, max = 20)
    private String firstName;

    @NotEmpty
    @Size(min = 1, max = 20)
    private String lastName;

    @JsonFormat(pattern = "yyyy-MM-dd")
    private Date dob;

    @NotEmpty
    private String gender;

    @NotNull
    @Min(value = 999999999L, message = "must be 10 digit")
    @Max(value = 9999999999L, message = "must be 10 digit")
    private Long mobileNo;

    @Email
    @NotEmpty
    private String email;

    @NotEmpty
    @Size(min = 6, max = 100)
    private String password;

    private Long roleId; // optional — defaults to VIEWER if not provided
}