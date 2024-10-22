package com.db.dbworld.dao.user;

import com.db.dbworld.entities.user.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
public interface UserRepository extends JpaRepository<UserEntity, Long> {

    Optional<UserEntity> findByEmail(String email);

    @Query(value = "SELECT role FROM DB_WORLD.USERS WHERE id= :id", nativeQuery = true)
    Integer getRoleByUserId(@Param(value="id") Integer id);

}
