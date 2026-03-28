package com.db.dbworld.app.cinema.tmdb.media.repository;

import com.db.dbworld.cinema.tmdb.enums.VideoType;
import com.db.dbworld.cinema.tmdb.media.entity.VideoEntity;
import com.db.dbworld.cinema.tmdb.enums.VideoSite;
import com.db.dbworld.cinema.tmdb.media.projection.VideoProjection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Collection;
import java.util.List;

public interface VideoRepository extends JpaRepository<VideoEntity, String> {

    List<VideoEntity> findAllByTmdbId(Long tmdbId);

    List<VideoEntity> findAllByTmdbIdIn(List<Long> tmdbIds);

    List<VideoEntity> findAllByTmdbIdInAndSite(List<Long> tmdbIds, VideoSite site);

    @Query("""
            SELECT
                v.tmdb.id as tmdbId,
                v.key as key,
                v.type as type
            FROM VideoEntity v
            WHERE v.tmdb.id IN :tmdbIds
            AND v.site = :site
            """)
    List<VideoProjection> findVideos(Collection<Long> tmdbIds, VideoSite site);

    @Query("""
       SELECT
           v.tmdb.id as tmdbId,
           v.key as key,
           v.type as type
       FROM VideoEntity v
       WHERE v.tmdb.id IN :tmdbIds
       AND v.site = :site
       AND v.type IN :types
       """)
    List<VideoProjection> findVideos(
            Collection<Long> tmdbIds,
            VideoSite site,
            Collection<VideoType> types
    );

}