package com.db.dbworld.app.admin.config.repository;

import com.db.dbworld.app.admin.config.entity.AppConfigEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AppConfigRepository extends JpaRepository<AppConfigEntity, String> {
}
