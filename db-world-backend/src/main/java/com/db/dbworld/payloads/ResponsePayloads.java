package com.db.dbworld.payloads;

import com.db.dbworld.payloads.dbcinema.DBCinemaRecordsDto;
import com.db.dbworld.payloads.pm.CredentialDto;
import com.db.dbworld.payloads.user.UserDto;
import com.db.dbworld.services.Impl.UserDetailImpl;
import lombok.*;
import org.springframework.stereotype.Component;

import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Component
@Data
public class ResponsePayloads {

//    public static Object PasswordMangerCredential;

    @Data
    public static class LoginResponse{
        String token;
        Map<String, Object> user = new HashMap<>();

        public LoginResponse(String token, UserDetailImpl userDetails){
            this.token = token;
            this.user.put("userId", userDetails.getUserId());
            this.user.put("email", userDetails.getUsername());
            this.user.put("name", userDetails.getFirstName() + " " + userDetails.getLastName());
            this.user.put("dob", userDetails.getDob());
        }

    }

    @Data
    public static class PasswordManagerCredential{
        private String id;
        private String host;
        private List<CredentialDto> credentials;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PaginationRecords{
        private int pageNumber;
        private int pageSize;
        private long totalElements;
        private boolean isEmpty;
        private boolean isFirst;
        private boolean isLast;
        private List<DBCinemaRecordsDto> records;
    }

    @Data
    public static class TmdbFilerResponse {
        private String status_message;
        private int status_code;
        private boolean success;
    }

    @Data
    public static class UserProfileResponse{
        private long userId;
        private String firstName;
        private String lastName;
        private int age;
        private Date dob;
        private String gender;
        private Long mobileNo;
        private String email;
        private String password;
        private UserDto.UserRole userRole;
        private Long noOfLogin;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PasswordManagerResponse {
        private String id;
        private String host;
        private List<CredentialDto> credentials;
    }

}
