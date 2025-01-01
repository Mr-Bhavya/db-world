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

    private String StreamOrder;
    private String ID;
    private String UniqueID;
    private String Format;
    private String Format_Profile;
    private String Format_Level;
    private String Format_Tier;
    private String HDR_Format;
    private String HDR_Format_Compatibility;
    private String CodecID;
    private double Duration;
    private int BitRate;
    private int Width;
    private int Height;
    private int Sampled_Width;
    private int Sampled_Height;
    private double PixelAspectRatio;
    private double DisplayAspectRatio;
    private String FrameRate_Mode;
    private double FrameRate;
    private int FrameRate_Num;
    private int FrameRate_Den;
    private int FrameCount;
    private String ColorSpace;
    private String ChromaSubsampling;
    private String ChromaSubsampling_Position;
    private int BitDepth;
    private double Delay;
    private String Delay_Source;
    private long StreamSize;
    private String Encoded_Library;
    private String Default;
    private String Forced;
    private String colour_description_present;
    private String colour_description_present_Source;
    private String colour_range;
    private String colour_range_Source;
    private String colour_primaries;
    private String colour_primaries_Source;
    private String transfer_characteristics;
    private String transfer_characteristics_Source;
    private String matrix_coefficients;
    private String matrix_coefficients_Source;
    private String MasteringDisplay_ColorPrimaries;
    private String MasteringDisplay_ColorPrimaries_Source;
    private String MasteringDisplay_Luminance;
    private String MasteringDisplay_Luminance_Source;
    private String MaxCLL;
    private String MaxCLL_Source;
    private String MaxFALL;
    private String MaxFALL_Source;

}

