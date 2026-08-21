package com.db.dbworld.app.cinema.catalog.entities;

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

    /**
     * The tag's identity, matching {@code tag_definitions.tag_type}.
     *
     * <p>A free-form String rather than the {@link com.db.dbworld.app.cinema.enums.RecordTagType}
     * enum, so admins can create their own curated tags ("Diwali Special", "Hidden Gems") without a
     * deploy. The enum still exists as the registry of BUILT-IN tags — the ones with a
     * {@code TagStrategy} behind them — and code that needs compile-time safety uses it, calling
     * {@code .name()} at the boundary. The column type and every JPQL comparison are unchanged;
     * this was already stored as a VARCHAR via {@code @Enumerated(STRING)}.
     *
     * <p>Always a value present in {@code tag_definitions}; validated on the way in by
     * {@code TagAdminService} rather than by the type system.
     */
    @Column(name = "tag_type", nullable = false, length = 50)
    private String tagType;

    private Integer priority;

}