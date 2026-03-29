package com.db.dbworld.app.media.info.entity.track;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@DiscriminatorValue("General")
@Getter
@Setter
@NoArgsConstructor
public class GeneralTrackEntity extends TrackEntity {

    @Column(name = "g_format", length = 100)
    private String format;

    @Column(name = "g_format_version", length = 50)
    private String formatVersion;

    @Column(name = "g_file_size")
    private Long fileSize;

    /** Duration in milliseconds */
    @Column(name = "g_duration")
    private Long duration;

    @Column(name = "g_overall_bit_rate")
    private Long overallBitRate;

    @Column(name = "g_video_count")
    private Integer videoCount;

    @Column(name = "g_audio_count")
    private Integer audioCount;

    @Column(name = "g_text_count")
    private Integer textCount;

    @Column(name = "g_file_extension", length = 20)
    private String fileExtension;

    @Column(name = "g_title", length = 500)
    private String title;

    @Column(name = "g_encoded_application", length = 200)
    private String encodedApplication;

    @Column(name = "g_encoded_date", length = 100)
    private String encodedDate;
}
