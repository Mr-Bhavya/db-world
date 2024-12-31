package com.db.dbworld.entities.dbcinema.stream;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.DiscriminatorValue;
import jakarta.persistence.Entity;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@DiscriminatorValue("Text")
public class TextInfoEntity extends TrackInfoEntity {

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
}

