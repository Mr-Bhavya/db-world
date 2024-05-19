package com.db.dbworld.dao.user;

import com.db.dbworld.entities.user.UserAppDataEntity;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface UserAppDataRepository extends MongoRepository<UserAppDataEntity, String> {
}
