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

    @Builder.Default
    private Integer limitSize = 20;

    @Builder.Default
    private boolean active = true;

    @Column(nullable = false)
    @Builder.Default
    private Boolean infiniteScroll = true;

    /**
     * How this rail's cards are rendered on the client (e.g. "standard", "wide",
     * "poster", "posterPlain", "prime", "jumbo", "top10", "billboard").
     * Null/blank = AUTO: the client derives it from the rule type (continueWatching →
     * continue, person → person) else falls back to the responsive default
     * (mobile poster / desktop 16:9). Admin-editable via the Tags &amp; Rails page.
     */
    @Column(name = "display_type", length = 30)
    private String displayType;

    /**
     * Which image variant the cards use: "WITH_TEXT" (poster with title /
     * backdrop with title-logo) or "WITHOUT_TEXT" (clean poster / clean backdrop).
     * Null/blank = AUTO (per display-type default). Admin-editable.
     */
    @Column(name = "image_variant", length = 20)
    private String imageVariant;

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