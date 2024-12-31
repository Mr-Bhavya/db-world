package com.db.dbworld.dao.user;

import com.db.dbworld.entities.user.UserCinemaDataEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface UserCinemaDataRepository extends JpaRepository<UserCinemaDataEntity, Long> {

    List<UserCinemaDataEntity> findAllByUserUserId(Long userId, Pageable pageable);

}
