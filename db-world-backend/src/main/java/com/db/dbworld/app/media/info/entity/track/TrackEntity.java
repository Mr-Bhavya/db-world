package com.db.dbworld.app.media.info.entity.track;

import com.db.dbworld.app.media.info.entity.MediaFileEntity;
import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Base entity for all media tracks (General, Video, Audio, Text).
 *
 * Uses SINGLE_TABLE inheritance — one `media_tracks` table with a `track_type` discriminator.
 * This keeps JOINs simple and queries fast.
 *
 * Each subtype stores only the most important fields as dedicated columns.
 * The full raw JSON for every track is stored in `extra_json` for
 * future extensibility without schema migrations.
 *
 * Replaces old TrackInfoEntity (entities.dbcinema.stream).
 */
@Entity
@Table(name = "media_tracks", schema = "db_world")
@Inheritance(strategy = InheritanceType.SINGLE_TABLE)
@DiscriminatorColumn(name = "track_type", discriminatorType = DiscriminatorType.STRING)
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = "@type", visible = true)
@JsonSubTypes({
        @JsonSubTypes.Type(value = GeneralTrackEntity.class, name = "General"),
        @JsonSubTypes.Type(value = VideoTrackEntity.class,   name = "Video"),
        @JsonSubTypes.Type(value = AudioTrackEntity.class,   name = "Audio"),
        @JsonSubTypes.Type(value = TextTrackEntity.class,    name = "Text"),
        @JsonSubTypes.Type(value = ImageTrackEntity.class,   name = "Image")
})
@Getter
@Setter
@NoArgsConstructor
public abstract class TrackEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", length = 36)
    private String id;

    /** Discriminator value: General, Video, Audio, Text */
    @Column(name = "track_type", insertable = false, updatable = false, length = 20)
    private String trackType;

    /** 0-based index within the media file (same as MediaInfo stream order). */
    @Column(name = "stream_order")
    private Integer streamOrder;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "media_file_id", nullable = false)
    private MediaFileEntity mediaFile;

    /**
     * Full raw JSON node for this track from `mediainfo --output=JSON`.
     * Stored as MySQL JSON type — enables JSON_EXTRACT() queries and schema-less extension.
     * Any MediaInfo field not promoted to a column can be queried via SQL JSON functions.
     */
    @Column(name = "extra_json", columnDefinition = "JSON")
    private String extraJson;
}
