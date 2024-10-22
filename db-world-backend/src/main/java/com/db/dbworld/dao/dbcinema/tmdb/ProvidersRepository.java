package com.db.dbworld.dao.dbcinema.tmdb;

import com.db.dbworld.entities.dbcinema.tmdb.providers.ProvidersEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProvidersRepository extends JpaRepository<ProvidersEntity, Long> {
}
