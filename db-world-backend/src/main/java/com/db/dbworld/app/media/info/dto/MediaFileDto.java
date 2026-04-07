package com.db.dbworld.app.media.info.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Getter;

import java.time.Instant;
import java.util.List;

@Getter
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class MediaFileDto {

    private String  id;
    private Long    recordId;
    private String  fileName;
    private String  filePath;
    private Long    fileSize;
    private String  mimeType;
    private String  ingestionJobId;
    private Instant createdAt;
    private Instant updatedAt;
    private List<TrackDto> tracks;

    // ── Convenience accessors computed from tracks ────────────────────────────

    public TrackDto getGeneralTrack() {
        if (tracks == null) return null;
        return tracks.stream().filter(t -> "General".equals(t.getType())).findFirst().orElse(null);
    }

    public TrackDto getPrimaryVideoTrack() {
        if (tracks == null) return null;
        return tracks.stream()
                .filter(t -> "Video".equals(t.getType()))
                .max((left, right) -> {
                    int leftHeight = left.getHeight() != null ? left.getHeight() : -1;
                    int rightHeight = right.getHeight() != null ? right.getHeight() : -1;
                    if (leftHeight != rightHeight) {
                        return Integer.compare(leftHeight, rightHeight);
                    }

                    long leftBitRate = left.getBitRate() != null ? left.getBitRate() : -1L;
                    long rightBitRate = right.getBitRate() != null ? right.getBitRate() : -1L;
                    if (leftBitRate != rightBitRate) {
                        return Long.compare(leftBitRate, rightBitRate);
                    }

                    long leftDuration = left.getDuration() != null ? left.getDuration() : -1L;
                    long rightDuration = right.getDuration() != null ? right.getDuration() : -1L;
                    return Long.compare(leftDuration, rightDuration);
                })
                .orElse(null);
    }

    public TrackDto getPrimaryAudioTrack() {
        if (tracks == null) return null;
        return tracks.stream()
                .filter(t -> "Audio".equals(t.getType()))
                .max((left, right) -> {
                    boolean leftDefault = "yes".equalsIgnoreCase(left.getDefaultTrack());
                    boolean rightDefault = "yes".equalsIgnoreCase(right.getDefaultTrack());
                    if (leftDefault != rightDefault) {
                        return Boolean.compare(leftDefault, rightDefault);
                    }

                    int leftChannels = left.getChannels() != null ? left.getChannels() : -1;
                    int rightChannels = right.getChannels() != null ? right.getChannels() : -1;
                    if (leftChannels != rightChannels) {
                        return Integer.compare(leftChannels, rightChannels);
                    }

                    long leftBitRate = left.getBitRate() != null ? left.getBitRate() : -1L;
                    long rightBitRate = right.getBitRate() != null ? right.getBitRate() : -1L;
                    return Long.compare(leftBitRate, rightBitRate);
                })
                .orElse(null);
    }
}
