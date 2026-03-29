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
        schema = "db_world",
        uniqueConstraints = { @UniqueConstraint(columnNames = {"record_id", "tag_type"}) }
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