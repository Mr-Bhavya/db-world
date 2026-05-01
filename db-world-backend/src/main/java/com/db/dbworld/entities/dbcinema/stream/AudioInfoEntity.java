//package com.db.dbworld.entities.dbcinema.stream;
//
//import com.fasterxml.jackson.annotation.JsonProperty;
//import jakarta.persistence.Column;
//import jakarta.persistence.DiscriminatorValue;
//import jakarta.persistence.Entity;
//import lombok.Getter;
//import lombok.Setter;
//
//@Getter
//@Setter
//@Entity
//@DiscriminatorValue("Audio")
//public class AudioInfoEntity extends TrackInfoEntity {
//    @Column(name = "unique_id")
//    @JsonProperty("UniqueID")
//    private String uniqueID;
//
//    @Column(name = "stream_order")
//    @JsonProperty("StreamOrder")
//    private String streamOrder;
//
//    @Column(name = "format")
//    @JsonProperty("Format")
//    private String format;
//
//    @Column(name = "format_commercial_if_any")
//    @JsonProperty("Format_Commercial_IfAny")
//    private String formatCommercialIfAny;
//
//    @Column(name = "format_settings_endianness")
//    @JsonProperty("Format_Settings_Endianness")
//    private String formatSettingsEndianness;
//
//    @Column(name = "codec_id")
//    @JsonProperty("CodecID")
//    private String codecID;
//
//    @Column(name = "duration")
//    @JsonProperty("Duration")
//    private Double duration;
//
//    @Column(name = "bit_rate_mode")
//    @JsonProperty("BitRate_Mode")
//    private String bitRateMode;
//
//    @Column(name = "bit_rate")
//    @JsonProperty("BitRate")
//    private Integer bitRate;
//
//    @Column(name = "channels")
//    @JsonProperty("Channels")
//    private Integer channels;
//
//    @Column(name = "channel_positions")
//    @JsonProperty("ChannelPositions")
//    private String channelPositions;
//
//    @Column(name = "channel_layout")
//    @JsonProperty("ChannelLayout")
//    private String channelLayout;
//
//    @Column(name = "samples_per_frame")
//    @JsonProperty("SamplesPerFrame")
//    private Integer samplesPerFrame;
//
//    @Column(name = "sampling_rate")
//    @JsonProperty("SamplingRate")
//    private Integer samplingRate;
//
//    @Column(name = "sampling_count")
//    @JsonProperty("SamplingCount")
//    private Long samplingCount;
//
//    @Column(name = "frame_rate")
//    @JsonProperty("FrameRate")
//    private Double frameRate;
//
//    @Column(name = "bit_depth")
//    @JsonProperty("BitDepth")
//    private Integer bitDepth;
//
//    @Column(name = "compression_mode")
//    @JsonProperty("Compression_Mode")
//    private String compressionMode;
//
//    @Column(name = "delay")
//    @JsonProperty("Delay")
//    private Double delay;
//
//    @Column(name = "delay_source")
//    @JsonProperty("Delay_Source")
//    private String delaySource;
//
//    @Column(name = "video_delay")
//    @JsonProperty("Video_Delay")
//    private Double videoDelay;
//
//    @Column(name = "stream_size")
//    @JsonProperty("StreamSize")
//    private Long streamSize;
//
//    @Column(name = "title")
//    @JsonProperty("Title")
//    private String title;
//
//    @Column(name = "language")
//    @JsonProperty("Language")
//    private String language;
//
//    @Column(name = "service_kind")
//    @JsonProperty("ServiceKind")
//    private String serviceKind;
//
//    @Column(name = "default_value")
//    @JsonProperty("Default")
//    private String defaultValue;
//
//    @Column(name = "forced")
//    @JsonProperty("Forced")
//    private String forced;
//}