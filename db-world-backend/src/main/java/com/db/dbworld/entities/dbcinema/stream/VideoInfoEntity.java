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

    @Column(name = "UniqueID")
    @JsonProperty("UniqueID")
    private String uniqueID;

    @Column(name = "StreamOrder")
    @JsonProperty("StreamOrder")
    private String streamOrder;

    @Column(name = "Format")
    @JsonProperty("Format")
    private String format;

    @Column(name = "Format_Profile")
    @JsonProperty("Format_Profile")
    private String formatProfile;

    @Column(name = "Format_Level")
    @JsonProperty("Format_Level")
    private String formatLevel;

    @Column(name = "Format_Tier")
    @JsonProperty("Format_Tier")
    private String formatTier;

    @Column(name = "HDR_Format")
    @JsonProperty("HDR_Format")
    private String hdrFormat;

    @Column(name = "HDR_Format_Compatibility")
    @JsonProperty("HDR_Format_Compatibility")
    private String hdrFormatCompatibility;

    @Column(name = "CodecID")
    @JsonProperty("CodecID")
    private String codecID;

    @Column(name = "Duration")
    @JsonProperty("Duration")
    private Double duration;

    @Column(name = "BitRate")
    @JsonProperty("BitRate")
    private Integer bitRate;

    @Column(name = "Width")
    @JsonProperty("Width")
    private Integer width;

    @Column(name = "Height")
    @JsonProperty("Height")
    private Integer height;

    @Column(name = "Sampled_Width")
    @JsonProperty("Sampled_Width")
    private Integer sampledWidth;

    @Column(name = "Sampled_Height")
    @JsonProperty("Sampled_Height")
    private Integer sampledHeight;

    @Column(name = "PixelAspectRatio")
    @JsonProperty("PixelAspectRatio")
    private Double pixelAspectRatio;

    @Column(name = "DisplayAspectRatio")
    @JsonProperty("DisplayAspectRatio")
    private Double displayAspectRatio;

    @Column(name = "FrameRate_Mode")
    @JsonProperty("FrameRate_Mode")
    private String frameRateMode;

    @Column(name = "FrameRate")
    @JsonProperty("FrameRate")
    private Double frameRate;

    @Column(name = "FrameRate_Num")
    @JsonProperty("FrameRate_Num")
    private Integer frameRateNum;

    @Column(name = "FrameRate_Den")
    @JsonProperty("FrameRate_Den")
    private Integer frameRateDen;

    @Column(name = "FrameCount")
    @JsonProperty("FrameCount")
    private Integer frameCount;

    @Column(name = "ColorSpace")
    @JsonProperty("ColorSpace")
    private String colorSpace;

    @Column(name = "ChromaSubsampling")
    @JsonProperty("ChromaSubsampling")
    private String chromaSubsampling;

    @Column(name = "ChromaSubsampling_Position")
    @JsonProperty("ChromaSubsampling_Position")
    private String chromaSubsamplingPosition;

    @Column(name = "BitDepth")
    @JsonProperty("BitDepth")
    private Integer bitDepth;

    @Column(name = "Delay")
    @JsonProperty("Delay")
    private Double delay;

    @Column(name = "Delay_Source")
    @JsonProperty("Delay_Source")
    private String delaySource;

    @Column(name = "StreamSize")
    @JsonProperty("StreamSize")
    private Long streamSize;

    @Column(name = "Encoded_Library")
    @JsonProperty("Encoded_Library")
    private String encodedLibrary;

    @Column(name = "`Default`")
    @JsonProperty("Default")
    private String defaultValue;

    @Column(name = "Forced")
    @JsonProperty("Forced")
    private String forced;

    @Column(name = "colour_description_present")
    @JsonProperty("colour_description_present")
    private String colourDescriptionPresent;

    @Column(name = "colour_description_present_Source")
    @JsonProperty("colour_description_present_Source")
    private String colourDescriptionPresentSource;

    @Column(name = "colour_range")
    @JsonProperty("colour_range")
    private String colourRange;

    @Column(name = "colour_range_Source")
    @JsonProperty("colour_range_Source")
    private String colourRangeSource;

    @Column(name = "colour_primaries")
    @JsonProperty("colour_primaries")
    private String colourPrimaries;

    @Column(name = "colour_primaries_Source")
    @JsonProperty("colour_primaries_Source")
    private String colourPrimariesSource;

    @Column(name = "transfer_characteristics")
    @JsonProperty("transfer_characteristics")
    private String transferCharacteristics;

    @Column(name = "transfer_characteristics_Source")
    @JsonProperty("transfer_characteristics_Source")
    private String transferCharacteristicsSource;

    @Column(name = "matrix_coefficients")
    @JsonProperty("matrix_coefficients")
    private String matrixCoefficients;

    @Column(name = "matrix_coefficients_Source")
    @JsonProperty("matrix_coefficients_Source")
    private String matrixCoefficientsSource;

    @Column(name = "MasteringDisplay_ColorPrimaries")
    @JsonProperty("MasteringDisplay_ColorPrimaries")
    private String masteringDisplayColorPrimaries;

    @Column(name = "MasteringDisplay_ColorPrimaries_Source")
    @JsonProperty("MasteringDisplay_ColorPrimaries_Source")
    private String masteringDisplayColorPrimariesSource;

    @Column(name = "MasteringDisplay_Luminance")
    @JsonProperty("MasteringDisplay_Luminance")
    private String masteringDisplayLuminance;

    @Column(name = "MasteringDisplay_Luminance_Source")
    @JsonProperty("MasteringDisplay_Luminance_Source")
    private String masteringDisplayLuminanceSource;

    @Column(name = "MaxCLL")
    @JsonProperty("MaxCLL")
    private String maxCLL;

    @Column(name = "MaxCLL_Source")
    @JsonProperty("MaxCLL_Source")
    private String maxCLLSource;

    @Column(name = "MaxFALL")
    @JsonProperty("MaxFALL")
    private String maxFALL;

    @Column(name = "MaxFALL_Source")
    @JsonProperty("MaxFALL_Source")
    private String maxFALLSource;

}

