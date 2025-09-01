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
@DiscriminatorValue("Video")
public class VideoInfoEntity extends TrackInfoEntity {

    @Column(name = "unique_id")
    @JsonProperty("UniqueID")
    private String uniqueID;

    @Column(name = "stream_order")
    @JsonProperty("StreamOrder")
    private String streamOrder;

    @Column(name = "format")
    @JsonProperty("Format")
    private String format;

    @Column(name = "format_profile")
    @JsonProperty("Format_Profile")
    private String formatProfile;

    @Column(name = "format_level")
    @JsonProperty("Format_Level")
    private String formatLevel;

    @Column(name = "format_tier")
    @JsonProperty("Format_Tier")
    private String formatTier;

    @Column(name = "hdr_format")
    @JsonProperty("HDR_Format")
    private String hdrFormat;

    @Column(name = "hdr_format_version")
    @JsonProperty("HDR_Format_Version")
    private String hdrFormatVersion;

    @Column(name = "hdr_format_compatibility")
    @JsonProperty("HDR_Format_Compatibility")
    private String hdrFormatCompatibility;

    @Column(name = "codec_id")
    @JsonProperty("CodecID")
    private String codecID;

    @Column(name = "duration")
    @JsonProperty("Duration")
    private Double duration;

    @Column(name = "bit_rate")
    @JsonProperty("BitRate")
    private Integer bitRate;

    @Column(name = "width")
    @JsonProperty("Width")
    private Integer width;

    @Column(name = "height")
    @JsonProperty("Height")
    private Integer height;

    @Column(name = "sampled_width")
    @JsonProperty("Sampled_Width")
    private Integer sampledWidth;

    @Column(name = "sampled_height")
    @JsonProperty("Sampled_Height")
    private Integer sampledHeight;

    @Column(name = "pixel_aspect_ratio")
    @JsonProperty("PixelAspectRatio")
    private Double pixelAspectRatio;

    @Column(name = "display_aspect_ratio")
    @JsonProperty("DisplayAspectRatio")
    private Double displayAspectRatio;

    @Column(name = "frame_rate_mode")
    @JsonProperty("FrameRate_Mode")
    private String frameRateMode;

    @Column(name = "frame_rate")
    @JsonProperty("FrameRate")
    private Double frameRate;

    @Column(name = "frame_rate_num")
    @JsonProperty("FrameRate_Num")
    private Integer frameRateNum;

    @Column(name = "frame_rate_den")
    @JsonProperty("FrameRate_Den")
    private Integer frameRateDen;

    @Column(name = "frame_count")
    @JsonProperty("FrameCount")
    private Integer frameCount;

    @Column(name = "color_space")
    @JsonProperty("ColorSpace")
    private String colorSpace;

    @Column(name = "chroma_subsampling")
    @JsonProperty("ChromaSubsampling")
    private String chromaSubsampling;

    @Column(name = "chroma_subsampling_position")
    @JsonProperty("ChromaSubsampling_Position")
    private String chromaSubsamplingPosition;

    @Column(name = "bit_depth")
    @JsonProperty("BitDepth")
    private Integer bitDepth;

    @Column(name = "delay")
    @JsonProperty("Delay")
    private Double delay;

    @Column(name = "delay_source")
    @JsonProperty("Delay_Source")
    private String delaySource;

    @Column(name = "stream_size")
    @JsonProperty("StreamSize")
    private Long streamSize;

    @Column(name = "encoded_library")
    @JsonProperty("Encoded_Library")
    private String encodedLibrary;

    @Column(name = "default_value")
    @JsonProperty("Default")
    private String defaultValue;

    @Column(name = "forced")
    @JsonProperty("Forced")
    private String forced;

    @Column(name = "colour_description_present")
    @JsonProperty("colour_description_present")
    private String colourDescriptionPresent;

    @Column(name = "colour_description_present_source")
    @JsonProperty("colour_description_present_Source")
    private String colourDescriptionPresentSource;

    @Column(name = "colour_range")
    @JsonProperty("colour_range")
    private String colourRange;

    @Column(name = "colour_range_source")
    @JsonProperty("colour_range_Source")
    private String colourRangeSource;

    @Column(name = "colour_primaries")
    @JsonProperty("colour_primaries")
    private String colourPrimaries;

    @Column(name = "colour_primaries_source")
    @JsonProperty("colour_primaries_Source")
    private String colourPrimariesSource;

    @Column(name = "transfer_characteristics")
    @JsonProperty("transfer_characteristics")
    private String transferCharacteristics;

    @Column(name = "transfer_characteristics_source")
    @JsonProperty("transfer_characteristics_Source")
    private String transferCharacteristicsSource;

    @Column(name = "matrix_coefficients")
    @JsonProperty("matrix_coefficients")
    private String matrixCoefficients;

    @Column(name = "matrix_coefficients_source")
    @JsonProperty("matrix_coefficients_Source")
    private String matrixCoefficientsSource;

    @Column(name = "mastering_display_color_primaries")
    @JsonProperty("MasteringDisplay_ColorPrimaries")
    private String masteringDisplayColorPrimaries;

    @Column(name = "mastering_display_color_primaries_source")
    @JsonProperty("MasteringDisplay_ColorPrimaries_Source")
    private String masteringDisplayColorPrimariesSource;

    @Column(name = "mastering_display_luminance")
    @JsonProperty("MasteringDisplay_Luminance")
    private String masteringDisplayLuminance;

    @Column(name = "mastering_display_luminance_source")
    @JsonProperty("MasteringDisplay_Luminance_Source")
    private String masteringDisplayLuminanceSource;

    @Column(name = "max_cll")
    @JsonProperty("MaxCLL")
    private String maxCLL;

    @Column(name = "max_cll_source")
    @JsonProperty("MaxCLL_Source")
    private String maxCLLSource;

    @Column(name = "max_fall")
    @JsonProperty("MaxFALL")
    private String maxFALL;

    @Column(name = "max_fall_source")
    @JsonProperty("MaxFALL_Source")
    private String maxFALLSource;
}