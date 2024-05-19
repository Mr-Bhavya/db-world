package com.db.dbworld.dao.user;

import com.db.dbworld.entities.user.UserRoleEntity;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface UserRoleRepository extends MongoRepository<UserRoleEntity, String> {
}
