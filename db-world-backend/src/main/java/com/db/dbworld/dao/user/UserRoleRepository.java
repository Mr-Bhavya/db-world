package com.db.dbworld.dao.user;

import com.db.dbworld.entities.user.UserRoleEntity;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface UserRoleRepository extends MongoRepository<UserRoleEntity, String> {
}
