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
        return tracks.stream().filter(t -> "Video".equals(t.getType())).findFirst().orElse(null);
    }

    public TrackDto getPrimaryAudioTrack() {
        if (tracks == null) return null;
        return tracks.stream().filter(t -> "Audio".equals(t.getType())).findFirst().orElse(null);
    }
}
