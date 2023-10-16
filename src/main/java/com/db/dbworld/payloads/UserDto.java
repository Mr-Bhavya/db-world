package com.db.dbworld.payloads;

import com.db.dbworld.entities.UserEntity;
import jakarta.validation.constraints.*;
import lombok.Data;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class UserDto {
    private String userId;
    @NotEmpty
    @Size(min = 3, max=15)
    private String firstName;
    @NotEmpty
    @Size(min = 3, max=15)
    private String lastName;
    private String age;
    @NotEmpty
    private String dob;
    @NotEmpty
    private String gender;
    @NotNull
    @Min(value = 999999999L , message = "must be 10 digit")
    @Max(value = 9999999999L , message = "must be 10 digit")
    private Long mobileNo;
    @Email
    @NotEmpty
    private String email;
    @NotEmpty
    @Size(max=10)
    private String password;
    private String userRole;
    private UserEntity.UserAppData userAppData;
    private List<UserEntity.UserCredential> userCredential;

    @Data
    public class UserAppData {
        private Long noOfLogin;
        private List<UserEntity.UserAppData.LoginDetails> loginDetails;

        @Data
        public class LoginDetails {
            private String timeStamp;
            private String userAgent;
        }
    }

    @Data
    public class UserCredential {
        private String host;
        private String credentials;
    }
}
