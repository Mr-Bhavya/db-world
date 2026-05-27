package com.db.dbworld.audit.activity.shipper;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface LogShipperStateRepository extends JpaRepository<LogShipperStateEntity, Byte> {
}
