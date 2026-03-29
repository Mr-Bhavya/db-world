package com.db.dbworld.payloads;

import com.db.dbworld.core.role.dto.RoleDto;
import com.db.dbworld.app.pm.dto.CredentialDto;
import com.db.dbworld.core.user.dto.UserDto;
import lombok.*;
import org.springframework.data.domain.Page;
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

        public LoginResponse(String token, UserDto userDetails){
            this.token = token;
            this.user.put("userId", userDetails.getUserId());
            this.user.put("email", userDetails.getEmail());
            this.user.put("name", userDetails.getFirstName() + " " + userDetails.getLastName());
            this.user.put("dob", userDetails.getDob());
            this.user.put("role", userDetails.getUserRole() != null ? userDetails.getUserRole().getName() : null);
        }

    }

    @Data
    public static class PasswordManagerCredential{
        private String id;
        private String host;
        private List<CredentialDto> credentials;
    }

//    @Data
//    @NoArgsConstructor
//    @AllArgsConstructor
//    public static class PaginationRecords{
//        private int pageNumber;
//        private int pageSize;
//        private long totalElements;
//        private boolean isEmpty;
//        private boolean isFirst;
//        private boolean isLast;
//        private List<DBCinemaRecordsDto> records;
//    }

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
        private RoleDto userRole;
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

    @Data
    public static class PagedResponse<T> {
        private List<T> content;
        private int page;
        private int size;
        private long totalElements;
        private int totalPages;
        private boolean last;

        public PagedResponse(Page<T> page) {
            this.content = page.getContent();
            this.page = page.getNumber();
            this.size = page.getSize();
            this.totalElements = page.getTotalElements();
            this.totalPages = page.getTotalPages();
            this.last = page.isLast();
        }
    }

    @Data
    @Builder
    public static class SymlinkRepairResult {
        private int total;
        private int repaired;
        private int deleted;
        private int skipped;
        private int failed;
        private boolean dryRun;
    }

    @Data
    @Builder
    public static class SymlinkRepairSingleResult {

        private String fileId;

        private boolean created;
        private boolean deleted;
        private boolean skipped;
        private boolean failed;

        private String message;
        private boolean dryRun;
    }

}
