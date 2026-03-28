package com.db.dbworld.dao.user;

import com.db.dbworld.entities.user.UserRoleEntity;
import org.springframework.data.jpa.repository.JpaRepository;


public interface UserRoleRepository extends JpaRepository<UserRoleEntity, Integer> {

    UserRoleEntity findByName(String name);

}
