package com.db.dbworld.payloads.user;

import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.Setter;

import java.util.Date;
import java.util.List;

@Getter
@Setter
public class UserDto {
    private Long userId;
    @NotEmpty
    @Size(min = 2, max = 20)
    private String firstName;
    @NotEmpty
    @Size(min = 1, max = 20)
    private String lastName;
    private int age;
    //    @NotEmpty
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
    @Size(max = 20)
    private String password;
    private UserRole userRole;
    private Date creationDate;
    private Date lastModifiedDate;
    private Long noOfLogin;
    private List<LoginData> loginData;
    private CinemaData cinemaData;

    @Getter
    @Setter
    public static class LoginData {
        private Date lastLoginDate;
        private String loginAgent;
    }

    @Getter
    @Setter
    public static class CinemaData {
        private List<String> download_files;
        private List<String> stream_files;
        private List<String> search_keywords;
    }



    @Getter
    @Setter
    public static class UserRole {
        @NotEmpty
        private String id;
        @NotEmpty
        private String name;
    }

    @Override
    public String toString() {
        return "Users{" +
                "userId='" + userId + '\'' +
                ", firstName='" + firstName + '\'' +
                ", lastName='" + lastName + '\'' +
                ", age='" + age + '\'' +
                ", gender='" + gender + '\'' +
                ", mobileNo='" + mobileNo + '\'' +
                ", email='" + email + '\'' +
                ", password='" + password + '\'' +
                '}';
    }
}
