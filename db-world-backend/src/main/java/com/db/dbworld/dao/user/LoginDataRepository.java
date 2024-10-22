package com.db.dbworld.dao.user;

import com.db.dbworld.entities.user.LoginDataEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;


public interface LoginDataRepository extends JpaRepository<LoginDataEntity, Integer> {

    @Query(value = "SELECT COUNT(*) FROM LOGIN_DATA WHERE USER = :userId", nativeQuery = true)
    Integer totalNumberOfLogin(@Param(value = "userId") Long userId);

    @Query(value = "SELECT * FROM LOGIN_DATA WHERE USER = :userId order by id desc limit 5", nativeQuery = true)
    List<LoginDataEntity> getLoginDataFromUserId (@Param(value = "userId") Long userId);

    List<LoginDataEntity> findByUserUserId(Long userId, Pageable pageable);

}
