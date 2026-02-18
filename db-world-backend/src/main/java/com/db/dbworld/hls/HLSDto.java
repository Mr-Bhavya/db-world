package com.db.dbworld.hls;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
public class HLSDto {
    @Data
    static class HLSContentResponse {
        private Long recordId;
        private String mediaFileId;
        private HLSStatus status;
        private LocalDateTime generatedAt;
        private String playbackUrl;
        private List<VariantInfo> variants;
    }

    @Data
    static class VariantInfo {
        private String resolution;
        private Integer width;
        private Integer height;
        private Long bitrate;
        private String playlistUrl;
        private String codec;
    }

    @Data
    class StartPlaybackRequest {
        private Long recordId;
        private String userId;
        private String deviceInfo;
        private String resolution;
    }

    @Data
    static class PlaybackSessionResponse {
        private String sessionId;
        private LocalDateTime startedAt;
        private String masterPlaylistUrl;
        private String message;
    }

    @Data
    public static class PlaybackHeartbeatRequest {
        private Double currentTime;
        private Double duration;
        private String resolution;
        private Long bitrate;
    }
}
