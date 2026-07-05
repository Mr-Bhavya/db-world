package com.db.dbworld.audit.tracking.shipper;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface TrackingShipperStateRepository extends JpaRepository<TrackingShipperStateEntity, Byte> {
}
