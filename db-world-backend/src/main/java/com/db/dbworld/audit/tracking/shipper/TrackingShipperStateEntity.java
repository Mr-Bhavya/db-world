package com.db.dbworld.audit.tracking.shipper;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "TRACKING_LOG_SHIPPER_STATE", schema = "new_db_world")
public class TrackingShipperStateEntity {

    /** Singleton row — always id = 1. */
    @Id
    @Column(name = "id")
    private Byte id = (byte) 1;

    @Column(name = "file_path", nullable = false, length = 500)
    private String filePath;

    @Column(name = "inode", nullable = false)
    private Long inode = 0L;

    @Column(name = "byte_offset", nullable = false)
    private Long byteOffset = 0L;

    @Column(name = "last_processed_at")
    private Instant lastProcessedAt;
}
