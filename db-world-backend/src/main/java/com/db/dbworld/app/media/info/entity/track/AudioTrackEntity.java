package com.db.dbworld.app.media.info.entity.track;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@DiscriminatorValue("Audio")
@Getter
@Setter
@NoArgsConstructor
public class AudioTrackEntity extends TrackEntity {

    @Column(name = "a_format", length = 100)
    private String format;

    @Column(name = "a_format_commercial", length = 100)
    private String formatCommercial;

    @Column(name = "a_codec_id", length = 50)
    private String codecId;

    @Column(name = "a_language", length = 50)
    private String language;

    @Column(name = "a_title", length = 300)
    private String title;

    @Column(name = "a_channels")
    private Integer channels;

    @Column(name = "a_channel_layout", length = 50)
    private String channelLayout;

    @Column(name = "a_sampling_rate")
    private Long samplingRate;

    @Column(name = "a_bit_rate")
    private Long bitRate;

    @Column(name = "a_bit_rate_mode", length = 20)
    private String bitRateMode;

    @Column(name = "a_compression_mode", length = 20)
    private String compressionMode;

    /** Duration in milliseconds */
    @Column(name = "a_duration")
    private Long duration;

    @Column(name = "a_stream_size")
    private Long streamSize;

    @Column(name = "a_default", length = 5)
    private String defaultTrack;

    @Column(name = "a_forced", length = 5)
    private String forced;
}
