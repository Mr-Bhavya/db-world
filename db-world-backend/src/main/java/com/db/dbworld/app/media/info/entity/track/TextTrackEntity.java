package com.db.dbworld.app.media.info.entity.track;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@DiscriminatorValue("Text")
@Getter
@Setter
@NoArgsConstructor
public class TextTrackEntity extends TrackEntity {

    @Column(name = "t_format", length = 100)
    private String format;

    @Column(name = "t_codec_id", length = 50)
    private String codecId;

    @Column(name = "t_language", length = 50)
    private String language;

    @Column(name = "t_title", length = 300)
    private String title;

    @Column(name = "t_default", length = 5)
    private String defaultTrack;

    @Column(name = "t_forced", length = 5)
    private String forced;

    @Column(name = "t_stream_size")
    private Long streamSize;

    @Column(name = "t_frame_rate", length = 20)
    private String frameRate;

    @Column(name = "t_frame_count")
    private Long frameCount;
}
