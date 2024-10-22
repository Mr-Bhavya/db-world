package com.db.dbworld.dao.dbcinema.tmdb;

import com.db.dbworld.entities.dbcinema.tmdb.ProductionCountriesEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProductionCountriesRepository extends JpaRepository<ProductionCountriesEntity, String> {
}
