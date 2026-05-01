package com.db.dbworld.core.role.repository;

import com.db.dbworld.core.role.entity.RoleEntity;
import com.db.dbworld.core.role.enums.Role;
import org.springframework.data.jpa.repository.JpaRepository;


public interface UserRoleRepository extends JpaRepository<RoleEntity, Integer> {

    RoleEntity findByName(Role name);

}
