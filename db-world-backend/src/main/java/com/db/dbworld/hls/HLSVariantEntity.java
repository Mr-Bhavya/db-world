package com.db.dbworld.hls;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "hls_variant")
@Getter
@Setter
public class HLSVariantEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "hls_content_id", nullable = false)
    private HLSContentEntity hlsContent;

    @Column(name = "resolution_name", nullable = false)
    private String resolutionName; // e.g., "1080p", "720p", "1080p_hdr"

    @Column(name = "width")
    private Integer width;

    @Column(name = "height")
    private Integer height;

    @Column(name = "codec")
    private String codec;

    @Column(name = "bitrate")
    private Long bitrate; // in bps

    @Column(name = "hls_path", length = 2000)
    private String hlsPath; // Path to index.m3u8

    @Column(name = "segment_count")
    private Integer segmentCount;

    @Column(name = "playlist_url")
    private String playlistUrl;

    @Column(name = "added_at")
    private LocalDateTime addedAt;
}
