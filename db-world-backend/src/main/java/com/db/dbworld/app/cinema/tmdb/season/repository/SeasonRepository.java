package com.db.dbworld.app.cinema.tmdb.season.repository;

import com.db.dbworld.cinema.tmdb.season.entity.SeasonEntity;
import jakarta.transaction.Transactional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface SeasonRepository extends JpaRepository<SeasonEntity, Long> {

    @Modifying
    @Transactional
    @Query("delete from SeasonEntity s where s.tvShow.id = :tvId")
    void deleteByTvShowId(Long tvId);
}
