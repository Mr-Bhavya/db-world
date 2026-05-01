package com.db.dbworld.app.media.info.entity.track;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@DiscriminatorValue("Video")
@Getter
@Setter
@NoArgsConstructor
public class VideoTrackEntity extends TrackEntity {

    @Column(name = "v_format", length = 100)
    private String format;

    @Column(name = "v_codec_id", length = 50)
    private String codecId;

    @Column(name = "v_profile", length = 100)
    private String profile;

    @Column(name = "v_width")
    private Integer width;

    @Column(name = "v_height")
    private Integer height;

    @Column(name = "v_display_aspect_ratio", length = 20)
    private String displayAspectRatio;

    @Column(name = "v_frame_rate", length = 20)
    private String frameRate;

    @Column(name = "v_bit_rate")
    private Long bitRate;

    @Column(name = "v_bit_depth")
    private Integer bitDepth;

    @Column(name = "v_color_space", length = 50)
    private String colorSpace;

    @Column(name = "v_hdr_format", length = 200)
    private String hdrFormat;

    @Column(name = "v_hdr_format_compatibility", length = 200)
    private String hdrFormatCompatibility;

    /** Duration in milliseconds */
    @Column(name = "v_duration")
    private Long duration;

    @Column(name = "v_stream_size")
    private Long streamSize;

    @Column(name = "v_default", length = 5)
    private String defaultTrack;

    @Column(name = "v_forced", length = 5)
    private String forced;
}
