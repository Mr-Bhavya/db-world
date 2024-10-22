package com.db.dbworld.payloads;

import com.db.dbworld.payloads.dbcinema.DBCinemaRecordsDto;
import com.db.dbworld.payloads.pm.CredentialDto;
import com.db.dbworld.services.Impl.UserDetailImpl;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.stereotype.Component;

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

    public class userResponse{

    }

}
