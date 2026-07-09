package com.db.dbworld.app.admin.config.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * One runtime-editable setting. Rows are seeded from {@code SettingsCatalog}
 * on startup and edited from the admin Settings page. The code-side catalog —
 * not this table — owns the set of known keys, their type, and defaults.
 */
@Entity
@Table(name = "app_config", schema = "db_world")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class AppConfigEntity {

    @Id
    @Column(name = "config_key", length = 150)
    private String configKey;

    @Column(name = "value", length = 1000)
    private String value;

    @Enumerated(EnumType.STRING)
    @Column(name = "value_type", length = 20, nullable = false)
    private ConfigValueType valueType;

    @Column(name = "category", length = 60, nullable = false)
    private String category;

    @Column(name = "label", length = 150, nullable = false)
    private String label;

    @Column(name = "description", length = 500)
    private String description;

    @Column(name = "default_value", length = 1000)
    private String defaultValue;

    @Column(name = "min_value")
    private Long minValue;

    @Column(name = "max_value")
    private Long maxValue;

    @Column(name = "requires_restart", nullable = false)
    @Builder.Default
    private boolean requiresRestart = false;

    @Column(name = "display_order", nullable = false)
    @Builder.Default
    private int displayOrder = 0;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "updated_by", length = 100)
    private String updatedBy;

    @PreUpdate
    void onUpdate() { updatedAt = LocalDateTime.now(); }
}
