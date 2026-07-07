package com.db.dbworld.app.cinema.catalog.entities;

import com.db.dbworld.app.cinema.enums.RecordTagType;
import jakarta.persistence.*;
import lombok.*;

@Getter
@Setter
@Entity
@Builder
@AllArgsConstructor
@NoArgsConstructor
@Table(
        name = "RECORD_TAGS",
        schema = "new_db_world",
        uniqueConstraints = { @UniqueConstraint(columnNames = {"record_id", "tag_type"}) },
        // record_id already indexed by its FK; tag_type-alone filtering + ORDER BY priority
        // (rail builder) is not covered by the record_id-leading unique key.
        indexes = { @Index(name = "idx_record_tags_type_priority", columnList = "tag_type, priority") }
)
public class RecordTagEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "record_id", nullable = false)
    private RecordEntity record;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private RecordTagType tagType;

    private Integer priority;

}