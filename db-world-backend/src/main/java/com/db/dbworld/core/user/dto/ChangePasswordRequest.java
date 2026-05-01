package com.db.dbworld.core.user.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class ChangePasswordRequest {

    @NotEmpty
    private String oldPassword;

    @NotEmpty
    @Size(min = 6, max = 100)
    private String newPassword;
}
