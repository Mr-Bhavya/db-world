package com.db.dbworld.entities.dbcinema.stream;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.DiscriminatorValue;
import jakarta.persistence.Entity;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@DiscriminatorValue("Audio")
public class AudioInfoEntity extends TrackInfoEntity {

    @JsonProperty("@typeorder")
    private int typeOrder;

    @JsonProperty("StreamOrder")
    private String streamOrder;

    @JsonProperty("Id")
    private String id;

    @JsonProperty("UniqueID")
    private String uniqueID;

    @JsonProperty("Format")
    private String format;

    @JsonProperty("FormatCommercialIfAny")
    private String formatCommercialIfAny;

    @JsonProperty("FormatSettingsEndianness")
    private String formatSettingsEndianness;

    @JsonProperty("FormatAdditionalFeatures")
    private String formatAdditionalFeatures;

    @JsonProperty("CodecID")
    private String codecID;

    @JsonProperty("Duration")
    private double duration;

    @JsonProperty("BitRateMode")
    private String bitRateMode;

    @JsonProperty("BitRate")
    private long bitRate;

    @JsonProperty("Channels")
    private int channels;

    @JsonProperty("ChannelPositions")
    private String channelPositions;

    @JsonProperty("ChannelLayout")
    private String channelLayout;

    @JsonProperty("SamplesPerFrame")
    private int samplesPerFrame;

    @JsonProperty("SamplingRate")
    private int samplingRate;

    @JsonProperty("SamplingCount")
    private long samplingCount;

    @JsonProperty("FrameRate")
    private double frameRate;

    @JsonProperty("FrameCount")
    private int frameCount;

    @JsonProperty("CompressionMode")
    private String compressionMode;

    @JsonProperty("Delay")
    private double delay;

    @JsonProperty("DelaySource")
    private String delaySource;

    @JsonProperty("VideoDelay")
    private double videoDelay;

    @JsonProperty("StreamSize")
    private long streamSize;

    @JsonProperty("Language")
    private String language;

    @JsonProperty("ServiceKind")
    private String serviceKind;

    @JsonProperty("DefaultFlag")
    private String defaultFlag;

    @JsonProperty("Forced")
    private String forced;

//    @JsonProperty("Extra")
//    private Extra extra;
//
//    @Getter
//    @Setter
//    private static class Extra {
//
//        @JsonProperty("ComplexityIndex")
//        private int complexityIndex;
//
//        @JsonProperty("NumberOfDynamicObjects")
//        private int numberOfDynamicObjects;
//
//        @JsonProperty("BedChannelCount")
//        private int bedChannelCount;
//
//        @JsonProperty("BedChannelConfiguration")
//        private String bedChannelConfiguration;
//
//        @JsonProperty("Bsid")
//        private String bsid;
//
//        @JsonProperty("Dialnorm")
//        private String dialnorm;
//
//        @JsonProperty("Compr")
//        private String compr;
//
//        @JsonProperty("Acmod")
//        private String acmod;
//
//        @JsonProperty("Lfeon")
//        private String lfeon;
//
//        @JsonProperty("DialnormAverage")
//        private String dialnormAverage;
//
//        @JsonProperty("DialnormMinimum")
//        private String dialnormMinimum;
//
//        @JsonProperty("ComprAverage")
//        private String comprAverage;
//
//        @JsonProperty("ComprMinimum")
//        private String comprMinimum;
//
//        @JsonProperty("ComprMaximum")
//        private String comprMaximum;
//
//        @JsonProperty("ComprCount")
//        private int comprCount;
//    }
}

