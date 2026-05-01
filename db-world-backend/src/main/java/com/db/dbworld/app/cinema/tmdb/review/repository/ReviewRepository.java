// ReviewRepository.java
package com.db.dbworld.app.cinema.tmdb.review.repository;

import com.db.dbworld.app.cinema.tmdb.review.entity.ReviewEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ReviewRepository extends JpaRepository<ReviewEntity, String> {
}