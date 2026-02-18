package com.db.dbworld.hls;

import com.db.dbworld.entities.dbcinema.stream.MediaFileInfoEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "hls_content")
@Getter
@Setter
public class HLSContentEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "media_file_info_id", nullable = false)
    private MediaFileInfoEntity mediaFileInfo;

    @Column(name = "record_id", nullable = false)
    private Long recordId;

    @Column(name = "master_playlist_path", length = 2000)
    private String masterPlaylistPath;

    @Column(name = "base_hls_path", length = 2000)
    private String baseHlsPath;

    @Column(name = "status")
    @Enumerated(EnumType.STRING)
    private HLSStatus status;

    @Column(name = "generated_at")
    private LocalDateTime generatedAt;

    @Column(name = "segment_duration")
    private Integer segmentDuration;

    @Column(name = "total_segments")
    private Integer totalSegments;

    @Column(name = "playback_url")
    private String playbackUrl;

    @Column(name = "cdn_url")
    private String cdnUrl;

    @OneToMany(mappedBy = "hlsContent", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<HLSVariantEntity> variants;
}
