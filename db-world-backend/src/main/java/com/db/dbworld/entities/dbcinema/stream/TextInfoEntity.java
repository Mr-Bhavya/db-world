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
    @Column(name = "UniqueID")
    @JsonProperty("UniqueID")
    private String uniqueID;

    @Column(name = "StreamOrder")
    @JsonProperty("StreamOrder")
    private String streamOrder;

    @Column(name = "Format")
    @JsonProperty("Format")
    private String format;

    @Column(name = "CodecID")
    @JsonProperty("CodecID")
    private String codecID;

    @Column(name = "Duration")
    @JsonProperty("Duration")
    private Double duration;

    @Column(name = "Title")
    @JsonProperty("Title")
    private String title;

    @Column(name = "Encoded_Library")
    @JsonProperty("Encoded_Library")
    private String encodedLibrary;

    @Column(name = "Language")
    @JsonProperty("Language")
    private String language;

    @Column(name = "`Default`")
    @JsonProperty("Default")
    private String defaultValue;

    @Column(name = "Forced")
    @JsonProperty("Forced")
    private String forced;

}

