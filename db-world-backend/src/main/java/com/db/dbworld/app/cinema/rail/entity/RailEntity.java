package com.db.dbworld.app.cinema.rail.entity;

import com.db.dbworld.cinema.enums.PageType;
import com.db.dbworld.cinema.enums.RailType;
import com.db.dbworld.cinema.enums.RecordTagType;
import com.db.dbworld.cinema.rail.converter.RailRuleJsonConverter;
import com.db.dbworld.cinema.rail.rule.RailRule;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "rails", schema = "db_world")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RailEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String title;

    private Integer priority;

    private Integer limitSize = 20;

    private boolean active = true;

    @Column(nullable = false)
    private Boolean infiniteScroll = true;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PageType pageType = PageType.HOME;

    /**
     * JSON rule describing how records are selected
     */
    @Column(columnDefinition = "JSON")
    @Convert(converter = RailRuleJsonConverter.class)
    private RailRule rule;

}