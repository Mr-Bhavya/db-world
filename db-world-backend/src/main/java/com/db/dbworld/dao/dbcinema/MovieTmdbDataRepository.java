package com.db.dbworld.dao.dbcinema;

import com.db.dbworld.entities.dbcinema.MovieTmdbDataEntity;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface MovieTmdbDataRepository extends MongoRepository<MovieTmdbDataEntity, Long> {
}
