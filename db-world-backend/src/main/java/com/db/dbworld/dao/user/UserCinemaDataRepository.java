package com.db.dbworld.dao.user;

import com.db.dbworld.entities.user.UserCinemaDataEntity;
import com.db.dbworld.entities.user.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface UserCinemaDataRepository extends JpaRepository<UserCinemaDataEntity, Long> {


}
