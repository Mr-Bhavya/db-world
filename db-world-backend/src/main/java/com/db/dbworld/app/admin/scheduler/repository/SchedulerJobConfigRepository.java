package com.db.dbworld.app.admin.scheduler.repository;

import com.db.dbworld.app.admin.scheduler.entity.SchedulerJobConfigEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SchedulerJobConfigRepository extends JpaRepository<SchedulerJobConfigEntity, String> {}
