package com.db.dbworld.entities.dbcinema.stream;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.Column;
import jakarta.persistence.DiscriminatorValue;
import jakarta.persistence.Entity;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@DiscriminatorValue("Text")
public class TextInfoEntity extends TrackInfoEntity {
    @Column(name = "unique_id")
    @JsonProperty("UniqueID")
    private String uniqueID;

    @Column(name = "stream_order")
    @JsonProperty("StreamOrder")
    private String streamOrder;

    @Column(name = "format")
    @JsonProperty("Format")
    private String format;

    @Column(name = "codec_id")
    @JsonProperty("CodecID")
    private String codecID;

    @Column(name = "duration")
    @JsonProperty("Duration")
    private Double duration;

    @Column(name = "title")
    @JsonProperty("Title")
    private String title;

    @Column(name = "encoded_library")
    @JsonProperty("Encoded_Library")
    private String encodedLibrary;

    @Column(name = "language")
    @JsonProperty("Language")
    private String language;

    @Column(name = "default_value")
    @JsonProperty("Default")
    private String defaultValue;

    @Column(name = "forced")
    @JsonProperty("Forced")
    private String forced;

    @Column(name = "bit_rate")
    @JsonProperty("BitRate")
    private String bitRate;

    @Column(name = "frame_rate")
    @JsonProperty("FrameRate")
    private String frameRate;

    @Column(name = "frame_count")
    @JsonProperty("FrameCount")
    private String frameCount;

    @Column(name = "stream_size")
    @JsonProperty("StreamSize")
    private String streamSize;

    @Column(name = "compression_mode")
    @JsonProperty("Compression_Mode")
    private String compressionMode;

    @Column(name = "element_count")
    @JsonProperty("ElementCount")
    private String elementCount;
}