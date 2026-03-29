package com.db.dbworld.app.media.info.entity.track;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Represents an embedded image (cover art / thumbnail) track inside a media container.
 *
 * MediaInfo reports embedded images as "@type": "Image" tracks.
 * Common for MKV files with cover art and MP4 files with album art.
 *
 * Also used when the FFmpeg enrichment step embeds a TMDB poster into the file.
 * In that case, `source` = "TMDB" and `tmdbPosterPath` holds the original path.
 *
 * Discriminator value: "Image"
 */
@Entity
@DiscriminatorValue("Image")
@Getter
@Setter
@NoArgsConstructor
public class ImageTrackEntity extends TrackEntity {

    /** Image codec: JPEG, PNG, BMP, etc. */
    @Column(name = "img_format", length = 50)
    private String format;

    @Column(name = "img_width")
    private Integer width;

    @Column(name = "img_height")
    private Integer height;

    /**
     * Image purpose description — e.g. "Cover", "Other", "Thumbnail".
     * Mapped from MediaInfo `Title` field or derived from TMDB source.
     */
    @Column(name = "img_title", length = 200)
    private String title;

    /** MIME type: image/jpeg, image/png */
    @Column(name = "img_mime_type", length = 50)
    private String mimeType;

    /** Stream size in bytes. */
    @Column(name = "img_stream_size")
    private Long streamSize;

    /**
     * Where this image came from.
     * Values: "EMBEDDED" (was already in file), "TMDB" (added by enrichment step).
     */
    @Column(name = "img_source", length = 20)
    private String source;

    /**
     * TMDB poster path (e.g. /abc123.jpg) — only set when source = "TMDB".
     * Full URL: https://image.tmdb.org/t/p/original{tmdbPosterPath}
     */
    @Column(name = "img_tmdb_poster_path", length = 300)
    private String tmdbPosterPath;
}
