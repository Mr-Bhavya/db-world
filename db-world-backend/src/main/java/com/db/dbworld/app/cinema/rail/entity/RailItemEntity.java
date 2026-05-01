package com.db.dbworld.app.cinema.rail.entity;

import com.db.dbworld.app.cinema.catalog.entities.RecordEntity;
import jakarta.persistence.*;
import lombok.*;

@Getter
@Setter
@Entity
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(
        name = "rail_items",
        schema = "new_db_world",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_rail_record",
                        columnNames = {"rail_id", "record_id"}
                )
        }
)
public class RailItemEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * Parent rail
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(
            name = "rail_id",
            nullable = false,
            foreignKey = @ForeignKey(name = "fk_rail_item_rail")
    )
    private RailEntity rail;

    /**
     * Media record
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(
            name = "record_id",
            nullable = false,
            foreignKey = @ForeignKey(name = "fk_rail_item_record")
    )
    private RecordEntity record;

    /**
     * Controls ordering inside the rail
     * Example: Top 10 ranking
     */
    @Column(nullable = false)
    private Integer priority;
}