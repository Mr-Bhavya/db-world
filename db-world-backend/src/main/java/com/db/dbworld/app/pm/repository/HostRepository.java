package com.db.dbworld.dao.pm;

import com.db.dbworld.app.pm.entity.HostEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface HostRepository extends JpaRepository<HostEntity, String> {

}
