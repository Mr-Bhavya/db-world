package com.db.dbworld.app.ipo.repository;

import com.db.dbworld.app.ipo.entity.IpoListingEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface IpoListingRepository extends JpaRepository<IpoListingEntity, String> {
    Optional<IpoListingEntity> findByMatchKey(String matchKey);
    List<IpoListingEntity> findByStatus(String status);
}
