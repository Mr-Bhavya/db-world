package com.db.dbworld.payloads.user;

import jakarta.validation.constraints.*;
import lombok.Data;
import lombok.Getter;
import lombok.Setter;
import org.bson.types.ObjectId;

import java.util.ArrayList;
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
    private int age;
    @NotEmpty
//    @DateTimeFormat()
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
    private UserRole userRole;
    private UserAppData userAppData;
    private List<PasswordManagerCredential> passwordManager;

    @Data
    public static class UserAppData {
        private ObjectId id;
        private Long noOfLogin;
        private List<LoginDetails> loginDetails;
        private CinemaRecord cinemaRecord;

        @Getter
        @Setter
        public static class CinemaRecord{
            private String id;
            private ArrayList<String> like;
            private ArrayList<String> disLike;
            private ArrayList<String> rate;
            private ArrayList<String> watchList;
            private String[] searchHistory;
            private String[] watched;
        }

        @Data
        public static class LoginDetails {
            private long timeStamp;
            private String userAgent;
        }
    }

    @Data
    public static class PasswordManagerCredential {
        private String host;
        private List<byte[]> credentials;
        private byte[] ivParameterSpec;
    }

    @Data
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
                ", userAppData=" + userAppData +
                '}';
    }
}
