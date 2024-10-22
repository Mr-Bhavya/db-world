package com.db.dbworld.payloads;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.*;

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
        @NotEmpty
        private String url;
        private String username;
        private String password;
        private String fileName;
        private boolean isUrlProtected;
        private boolean isRename;
        private boolean isExtract;
        private String extractPassword;
    }

    @Getter
    @Setter
    public static class YtDlp extends MirrorStatus.YtDlp {
        public YtDlp(){
            super();
        }
    }

}
