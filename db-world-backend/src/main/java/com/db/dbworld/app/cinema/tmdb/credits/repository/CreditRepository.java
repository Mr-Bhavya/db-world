package com.db.dbworld.app.cinema.tmdb.credits.repository;

import com.db.dbworld.app.cinema.tmdb.credits.entity.CreditEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CreditRepository extends JpaRepository<CreditEntity, String> {
}
