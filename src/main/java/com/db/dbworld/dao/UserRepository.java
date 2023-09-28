package com.db.dbworld.dao;

import com.db.dbworld.entities.UserEntity;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface UserRepository extends MongoRepository<UserEntity, String> {
}
