package com.db.dbworld.app.ipo.repository;

import com.db.dbworld.app.ipo.entity.IpoUserApplicationEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

public interface IpoUserApplicationRepository extends JpaRepository<IpoUserApplicationEntity, String> {

    List<IpoUserApplicationEntity> findByUserId(Long userId);

    Optional<IpoUserApplicationEntity> findByUserIdAndIpoId(Long userId, String ipoId);

    @Modifying
    @Transactional
    void deleteByUserIdAndIpoId(Long userId, String ipoId);
}
