package com.db.dbworld.app.cinema.tmdb.providers.repository;

import com.db.dbworld.app.cinema.tmdb.enums.ProviderType;
import com.db.dbworld.app.cinema.tmdb.providers.dto.ProviderProjection;
import com.db.dbworld.app.cinema.tmdb.providers.entity.TmdbProviderEntity;
import io.lettuce.core.dynamic.annotation.Param;
import jakarta.transaction.Transactional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface TmdbProviderRepository extends JpaRepository<TmdbProviderEntity, Long> {
    @Query("SELECT t FROM TmdbProviderEntity t WHERE t.tmdb.id = :tmdbId AND t.provider.id = :providerId AND t.providerType = :providerType AND t.regionCode = :regionCode")
    Optional<TmdbProviderEntity> findByTmdbIdAndProviderIdAndProviderTypeAndRegionCode(
            @Param("tmdbId") Long tmdbId,
            @Param("providerId") Long providerId,
            @Param("providerType") ProviderType providerType,
            @Param("regionCode") String regionCode
    );

    @Modifying
    @Transactional
    @Query("delete from TmdbProviderEntity p where p.tmdb.id = :tmdbId")
    void deleteByTmdbId(Long tmdbId);

    List<TmdbProviderEntity> findByTmdbIdAndRegionCode(Long tmdb, String regionCode);

    List<TmdbProviderEntity> findAllByTmdbId(Long tmdbId);

    List<TmdbProviderEntity> findAllByTmdbIdIn(List<Long> tmdbIds);

    @Query("""
       SELECT
           tp.tmdb.id as tmdbId,
           tp.id as tmdbProviderId,
           p.id as providerId,
           p.name as providerName,
           p.logoPath as logoPath,
           tp.providerType as providerType,
           p.displayPriority as displayPriority
       FROM TmdbProviderEntity tp
       JOIN tp.provider p
       WHERE tp.tmdb.id IN :tmdbIds
       AND tp.regionCode = :region
       """)
    List<ProviderProjection> findProvidersByTmdbIdIn(Collection<Long> tmdbIds, String region);

    List<TmdbProviderEntity> findAllByTmdbIdInAndRegionCode(List<Long> tmdbIds, String regionCodeIn);
}
