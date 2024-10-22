package com.db.dbworld.dao.dbcinema.tmdb;

import com.db.dbworld.entities.dbcinema.tmdb.ProductionCompaniesEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProductionCompaniesRepository extends JpaRepository<ProductionCompaniesEntity, Integer> {
}
