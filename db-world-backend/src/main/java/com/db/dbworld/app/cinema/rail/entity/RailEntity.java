package com.db.dbworld.app.cinema.rail.entity;

import com.db.dbworld.app.cinema.enums.PageType;
import com.db.dbworld.app.cinema.rail.converter.RailRuleJsonConverter;
import com.db.dbworld.app.cinema.rail.rule.RailRule;
import jakarta.persistence.*;
import lombok.*;

import java.util.EnumSet;
import java.util.Set;

@Entity
@Table(name = "rails", schema = "new_db_world")
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

    /**
     * Legacy single-page field. Kept for backward compatibility while existing rails are
     * migrated to {@link #pageTypes}. Reads should prefer pageTypes; writes mirror the
     * first element here so callers stuck on the old API still see something sensible.
     * Will be removed once all callers are migrated.
     */
    @Deprecated
    @Enumerated(EnumType.STRING)
    @Column(name = "page_type")
    private PageType pageType;

    /**
     * Pages this rail appears on. A rail can target any subset of pages; the admin UI's
     * "All" sub-tab corresponds to rails with more than one entry here. Hibernate creates
     * the {@code rails_page_types} join table automatically (ddl-auto=update).
     */
    @ElementCollection(targetClass = PageType.class, fetch = FetchType.EAGER)
    @CollectionTable(
            name = "rails_page_types",
            schema = "new_db_world",
            joinColumns = @JoinColumn(name = "rail_id")
    )
    @Enumerated(EnumType.STRING)
    @Column(name = "page_type", nullable = false, length = 32)
    @Builder.Default
    private Set<PageType> pageTypes = EnumSet.of(PageType.HOME);

    /**
     * JSON rule describing how records are selected
     */
    @Column(columnDefinition = "JSON")
    @Convert(converter = RailRuleJsonConverter.class)
    private RailRule rule;

    /**
     * Convenience: does this rail appear on the given page?
     */
    public boolean appliesTo(PageType page) {
        return pageTypes != null && pageTypes.contains(page);
    }
}