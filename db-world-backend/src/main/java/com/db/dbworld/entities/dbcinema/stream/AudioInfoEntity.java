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
@DiscriminatorValue("Audio")
public class AudioInfoEntity extends TrackInfoEntity {
    @JsonProperty("UniqueID")
    private String uniqueID;

    @Column(name = "StreamOrder")
    @JsonProperty("StreamOrder")
    private String streamOrder;

    @Column(name = "Format")
    @JsonProperty("Format")
    private String format;

    @Column(name = "Format_Commercial_IfAny")
    @JsonProperty("Format_Commercial_IfAny")
    private String formatCommercialIfAny;

    @Column(name = "Format_Settings_Endianness")
    @JsonProperty("Format_Settings_Endianness")
    private String formatSettingsEndianness;

    @Column(name = "CodecID")
    @JsonProperty("CodecID")
    private String codecID;

    @Column(name = "Duration")
    @JsonProperty("Duration")
    private Double duration;

    @Column(name = "BitRate_Mode")
    @JsonProperty("BitRate_Mode")
    private String bitRateMode;

    @Column(name = "BitRate")
    @JsonProperty("BitRate")
    private Integer bitRate;

    @Column(name = "Channels")
    @JsonProperty("Channels")
    private Integer channels;

    @Column(name = "ChannelPositions")
    @JsonProperty("ChannelPositions")
    private String channelPositions;

    @Column(name = "ChannelLayout")
    @JsonProperty("ChannelLayout")
    private String channelLayout;

    @Column(name = "SamplesPerFrame")
    @JsonProperty("SamplesPerFrame")
    private Integer samplesPerFrame;

    @Column(name = "SamplingRate")
    @JsonProperty("SamplingRate")
    private Integer samplingRate;

    @Column(name = "SamplingCount")
    @JsonProperty("SamplingCount")
    private Long samplingCount;

    @Column(name = "FrameRate")
    @JsonProperty("FrameRate")
    private Double frameRate;

    @Column(name = "BitDepth")
    @JsonProperty("BitDepth")
    private Integer bitDepth;

    @Column(name = "Compression_Mode")
    @JsonProperty("Compression_Mode")
    private String compressionMode;

    @Column(name = "Delay")
    @JsonProperty("Delay")
    private Double delay;

    @Column(name = "Delay_Source")
    @JsonProperty("Delay_Source")
    private String delaySource;

    @Column(name = "Video_Delay")
    @JsonProperty("Video_Delay")
    private Double videoDelay;

    @Column(name = "StreamSize")
    @JsonProperty("StreamSize")
    private Long streamSize;

    @Column(name = "Title")
    @JsonProperty("Title")
    private String title;

    @Column(name = "Language")
    @JsonProperty("Language")
    private String language;

    @Column(name = "ServiceKind")
    @JsonProperty("ServiceKind")
    private String serviceKind;

    @Column(name = "`Default`")
    @JsonProperty("Default")
    private String defaultValue;

    @Column(name = "Forced")
    @JsonProperty("Forced")
    private String forced;
}

