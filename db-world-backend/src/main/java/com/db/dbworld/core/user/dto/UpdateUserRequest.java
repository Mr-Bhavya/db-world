package com.db.dbworld.core.user.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.validation.constraints.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.Date;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class UpdateUserRequest {
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

    /** Optional — when provided, changes the login email (uniqueness enforced in the service). */
    @Email
    private String email;

    @Size(min = 6, max = 100)
    private String password;
}
