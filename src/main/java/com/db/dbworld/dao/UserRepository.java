package com.db.dbworld.dao;

import com.db.dbworld.entities.UserEntity;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

public interface UserRepository extends MongoRepository<UserEntity, String> {

    public Optional<UserEntity> findByEmail(String email);

}
