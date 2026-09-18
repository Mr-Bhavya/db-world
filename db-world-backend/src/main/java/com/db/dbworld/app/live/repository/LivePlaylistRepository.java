package com.db.dbworld.app.live.repository;

import com.db.dbworld.app.live.entity.LivePlaylistEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface LivePlaylistRepository extends JpaRepository<LivePlaylistEntity, String> {

    List<LivePlaylistEntity> findAllByOrderByPriorityAscNameAsc();

    List<LivePlaylistEntity> findByEnabledTrueOrderByPriorityAscNameAsc();

    Optional<LivePlaylistEntity> findByUrl(String url);

    boolean existsByUrl(String url);
}
