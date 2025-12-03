package com.db.dbworld.payloads;

import com.db.dbworld.utils.DbWorldConstants;
import jakarta.validation.constraints.*;
import lombok.*;

import java.util.List;

public class RequestPayloads {

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AddRecord{
        @NotEmpty(message = "should not be empty or null")
        private String name;
        @NotNull(message = "should not be empty or null")
        private long tmdbId;
        @NotEmpty(message = "should not be empty or null")
        private String type;
        private boolean showOnTop;
    }

    @Data
    @ToString
    public static class AddCredential{
        @NotEmpty
        private String url;
        private String id;
        @NotEmpty
        private String username;
        private String password;
        private String pin;
        private String notes;
    }

    @Data
    public static class AddUserRole{
        @NotEmpty
        private String name;
    }

    @Data
    public static class Mirror{
        private String url;
        private List<String> urls;
        private String folderName;
        private String username;
        private String password;
        private String fileName;
        private Long fileSize;
        private boolean isUrlProtected;
        private boolean isRename;
        private boolean isExtract;
        private String extractPassword;
        private String videoITag;
        private String audioITag;
        private boolean onlyAudio;
    }

    @Data
    @AllArgsConstructor
    @NoArgsConstructor
    public static class UserRequest{
//        private Long userId;
        @NotEmpty
        @Size(min = 2, max=20)
        private String firstName;
        @NotEmpty
        @Size(min = 1, max=20)
        private String lastName;
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
        @Size(max=20)
        private String password;
    }

    @Getter
    @Setter
    public static class InformationCollector{
        private String event;
        private String file;
        private String value;
    }
}
