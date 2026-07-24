package com.db.dbworld.app.ipo.repository;

import com.db.dbworld.app.ipo.entity.IpoChangeEventEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface IpoChangeEventRepository extends JpaRepository<IpoChangeEventEntity, String> {
    List<IpoChangeEventEntity> findTop50ByOrderByCreatedAtDesc();
}
