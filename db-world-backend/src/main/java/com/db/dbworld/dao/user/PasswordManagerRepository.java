package com.db.dbworld.dao.user;

import com.db.dbworld.entities.user.PasswordManagerCredential;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface PasswordManagerRepository extends MongoRepository<PasswordManagerCredential, String> {
}
