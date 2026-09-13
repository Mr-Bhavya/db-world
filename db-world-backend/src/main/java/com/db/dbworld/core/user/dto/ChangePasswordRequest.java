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
    // Minimum 8, the NIST SP 800-63B floor. It was 6, which against a login endpoint that
    // had no rate limiting at all was the weakest link on the web side; LoginRateLimiter
    // closes the other half. Existing passwords are unaffected - this validates new input.
    @Size(min = 8, max = 100)
    private String newPassword;
}
