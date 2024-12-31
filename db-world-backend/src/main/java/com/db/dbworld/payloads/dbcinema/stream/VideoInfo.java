package com.db.dbworld.payloads.dbcinema.stream;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class VideoInfo extends TrackInfo {

    @JsonProperty("StreamOrder")
    private String streamOrder;

    @JsonProperty("Id")
    private String id;

    @JsonProperty("UniqueID")
    private String uniqueID;

    @JsonProperty("Format")
    private String format;

    @JsonProperty("FormatProfile")
    private String formatProfile;

    @JsonProperty("FormatLevel")
    private String formatLevel;

    @JsonProperty("FormatTier")
    private String formatTier;

    @JsonProperty("HdrFormat")
    private String hdrFormat;

    @JsonProperty("HdrFormatVersion")
    private String hdrFormatVersion;

    @JsonProperty("HdrFormatCompatibility")
    private String hdrFormatCompatibility;

    @JsonProperty("CodecID")
    private String codecID;

    @JsonProperty("Duration")
    private double duration;

    @JsonProperty("BitRate")
    private long bitRate;

    @JsonProperty("Width")
    private int width;

    @JsonProperty("Height")
    private int height;

    @JsonProperty("SampledWidth")
    private int sampledWidth;

    @JsonProperty("SampledHeight")
    private int sampledHeight;

    @JsonProperty("PixelAspectRatio")
    private double pixelAspectRatio;

    @JsonProperty("DisplayAspectRatio")
    private double displayAspectRatio;

    @JsonProperty("FrameRateMode")
    private String frameRateMode;

    @JsonProperty("FrameRate")
    private double frameRate;

    @JsonProperty("FrameRateNum")
    private int frameRateNum;

    @JsonProperty("FrameRateDen")
    private int frameRateDen;

    @JsonProperty("FrameCount")
    private int frameCount;

    @JsonProperty("ColorSpace")
    private String colorSpace;

    @JsonProperty("ChromaSubsampling")
    private String chromaSubsampling;

    @JsonProperty("ChromaSubsamplingPosition")
    private String chromaSubsamplingPosition;

    @JsonProperty("BitDepth")
    private int bitDepth;

    @JsonProperty("Delay")
    private double delay;

    @JsonProperty("DelaySource")
    private String delaySource;

    @JsonProperty("StreamSize")
    private long streamSize;

    @JsonProperty("DefaultFlag")
    private String defaultFlag;

    @JsonProperty("Forced")
    private String forced;

    @JsonProperty("ColourDescriptionPresent")
    private String colourDescriptionPresent;

    @JsonProperty("ColourDescriptionPresentSource")
    private String colourDescriptionPresentSource;

    @JsonProperty("ColourRange")
    private String colourRange;

    @JsonProperty("ColourRangeSource")
    private String colourRangeSource;

    @JsonProperty("ColourPrimaries")
    private String colourPrimaries;

    @JsonProperty("ColourPrimariesSource")
    private String colourPrimariesSource;

    @JsonProperty("TransferCharacteristics")
    private String transferCharacteristics;

    @JsonProperty("TransferCharacteristicsSource")
    private String transferCharacteristicsSource;

    @JsonProperty("MatrixCoefficients")
    private String matrixCoefficients;

    @JsonProperty("MatrixCoefficientsSource")
    private String matrixCoefficientsSource;

    @JsonProperty("MasteringDisplayColorPrimaries")
    private String masteringDisplayColorPrimaries;

    @JsonProperty("MasteringDisplayColorPrimariesSource")
    private String masteringDisplayColorPrimariesSource;

    @JsonProperty("MasteringDisplayLuminance")
    private String masteringDisplayLuminance;

    @JsonProperty("MasteringDisplayLuminanceSource")
    private String masteringDisplayLuminanceSource;

    @JsonProperty("MaxCLL")
    private String maxCLL;

    @JsonProperty("MaxCLLSource")
    private String maxCLLSource;

    @JsonProperty("MaxFALL")
    private String maxFALL;

    @JsonProperty("MaxFALLSource")
    private String maxFALLSource;
}

