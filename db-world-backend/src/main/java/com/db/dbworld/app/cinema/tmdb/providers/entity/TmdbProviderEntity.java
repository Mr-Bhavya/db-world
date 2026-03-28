package com.db.dbworld.app.cinema.tmdb.providers.entity;

import com.db.dbworld.cinema.tmdb.entities.TmdbEntity;
import com.db.dbworld.cinema.tmdb.enums.ProviderType;
import jakarta.persistence.*;
import lombok.*;

import java.util.Objects;

@Getter
@Setter
@Entity
@AllArgsConstructor
@NoArgsConstructor
@Table(
        name = "tmdb_providers",
        schema = "db_world",
        uniqueConstraints = {
                @UniqueConstraint(
                        columnNames = {
                                "tmdb_id",
                                "provider_id",
                                "provider_type",
                                "region_code"
                        }
                )
        }
)
public class TmdbProviderEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "tmdb_id", nullable = false)
    private TmdbEntity tmdb;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "provider_id", nullable = false)
    private ProviderEntity provider;

    @Enumerated(EnumType.STRING)
    private ProviderType providerType;

    @Column(name = "region_code", length = 5)
    private String regionCode;

    @Column(length = 1024)
    private String link;

    /* ===============================
       Equality based on unique key
       =============================== */

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof TmdbProviderEntity that)) return false;

        Long thisTmdb = tmdb != null ? tmdb.getId() : null;
        Long thatTmdb = that.tmdb != null ? that.tmdb.getId() : null;

        Long thisProvider = provider != null ? provider.getId() : null;
        Long thatProvider = that.provider != null ? that.provider.getId() : null;

        return Objects.equals(thisTmdb, thatTmdb)
                && Objects.equals(thisProvider, thatProvider)
                && providerType == that.providerType
                && Objects.equals(regionCode, that.regionCode);
    }

    @Override
    public int hashCode() {
        Long tmdbId = tmdb != null ? tmdb.getId() : null;
        Long providerId = provider != null ? provider.getId() : null;

        return Objects.hash(tmdbId, providerId, providerType, regionCode);
    }
}