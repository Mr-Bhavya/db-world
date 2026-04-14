package com.db.dbworld.app.cinema.catalog.tags.entity;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface TagDefinitionRepository extends JpaRepository<TagDefinitionEntity, String> {
}
