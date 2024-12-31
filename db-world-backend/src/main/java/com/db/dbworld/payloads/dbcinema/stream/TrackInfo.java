package com.db.dbworld.payloads.dbcinema.stream;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = "@type", include = JsonTypeInfo.As.PROPERTY, visible = true)
@JsonSubTypes({
        @JsonSubTypes.Type(value = GeneralInfo.class, name = "General"),
        @JsonSubTypes.Type(value = VideoInfo.class, name = "Video"),
        @JsonSubTypes.Type(value = AudioInfo.class, name = "Audio"),
        @JsonSubTypes.Type(value = TextInfo.class, name = "Text"),
        @JsonSubTypes.Type(value = String.class, name = "Image"),
        @JsonSubTypes.Type(value = MenuInfo.class, name = "Menu")
})
public class TrackInfo {
    @JsonProperty("@type")
    private String type;
}
