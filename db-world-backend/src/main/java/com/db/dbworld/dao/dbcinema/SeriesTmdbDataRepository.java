package com.db.dbworld.dao.dbcinema;

import com.db.dbworld.entities.dbcinema.SeriesTmdbDataEntity;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface SeriesTmdbDataRepository extends MongoRepository<SeriesTmdbDataEntity, Long> {
}
