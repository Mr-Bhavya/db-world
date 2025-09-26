package com.db.dbworld.entities.dbcinema.stream;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.springframework.data.redis.core.RedisHash;

@Getter
@Setter
@Entity
@Table(name = "MEDIA_TRACK_INFO", schema = "db-world")
@Inheritance(strategy = InheritanceType.SINGLE_TABLE)
@DiscriminatorColumn(name = "track_type", discriminatorType = DiscriminatorType.STRING)
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = "@type", include = JsonTypeInfo.As.PROPERTY, visible = true)
@JsonSubTypes({
        @JsonSubTypes.Type(value = GeneralInfoEntity.class, name = "General"),
        @JsonSubTypes.Type(value = VideoInfoEntity.class, name = "Video"),
        @JsonSubTypes.Type(value = AudioInfoEntity.class, name = "Audio"),
        @JsonSubTypes.Type(value = TextInfoEntity.class, name = "Text"),
        @JsonSubTypes.Type(value = String.class, name = "Image"),
        @JsonSubTypes.Type(value = MenuInfoEntity.class, name = "Menu")
})
public class TrackInfoEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @JsonProperty("ID")
    private String id;

    @JsonProperty("@type")
    private String type;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "media_file_info", referencedColumnName = "id")
    private MediaFileInfoEntity mediaFileInfo;
}
