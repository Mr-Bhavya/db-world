package com.db.dbworld.payloads.dbcinema.stream;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class TextInfo extends TrackInfo{

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

    @JsonProperty("CodecID")
    private String codecID;

    @JsonProperty("Duration")
    private double duration;

    @JsonProperty("BitRate")
    private int bitRate;

    @JsonProperty("FrameRate")
    private double frameRate;

    @JsonProperty("FrameCount")
    private int frameCount;

    @JsonProperty("ElementCount")
    private int elementCount;

    @JsonProperty("StreamSize")
    private long streamSize;

    @JsonProperty("Language")
    private String language;

    @JsonProperty("DefaultFlag")
    private String defaultFlag;

    @JsonProperty("Forced")
    private String forced;

    private String StreamOrder;
    private String ID;
    private String UniqueID;
    private String Format;
    private String CodecID;
    private double Duration;
    private String Title;
    private String Encoded_Library;
    private String Language;
    private String Default;
    private String Forced;
}

