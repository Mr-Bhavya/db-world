package com.db.dbworld.dao.dbcinema;

import com.db.dbworld.entities.dbcinema.DBCinemaRecordsEntity;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface DBCinemaRecordsRepository extends MongoRepository<DBCinemaRecordsEntity, String> {
}
