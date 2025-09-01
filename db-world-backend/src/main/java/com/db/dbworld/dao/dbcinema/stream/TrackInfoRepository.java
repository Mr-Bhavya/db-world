package com.db.dbworld.dao.dbcinema.stream;

import com.db.dbworld.entities.dbcinema.stream.TrackInfoEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.redis.repository.configuration.EnableRedisRepositories;

public interface TrackInfoRepository extends JpaRepository<TrackInfoEntity, String> {
}
