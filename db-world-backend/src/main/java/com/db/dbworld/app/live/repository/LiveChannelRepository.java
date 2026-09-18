package com.db.dbworld.app.live.repository;

import com.db.dbworld.app.live.entity.LiveChannelEntity;
import com.db.dbworld.app.live.entity.LiveHealth;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface LiveChannelRepository extends JpaRepository<LiveChannelEntity, String> {

    Optional<LiveChannelEntity> findByChannelKey(String channelKey);

    List<LiveChannelEntity> findByChannelKeyIn(Collection<String> channelKeys);

    /**
     * The public channel list: enabled, and not known to be dead. UNKNOWN is deliberately
     * included — a channel imported since the last health run has no verdict yet, and
     * hiding it would make a fresh playlist look like it imported nothing.
     */
    @Query("""
           select c from LiveChannelEntity c
           where c.enabled = true and c.health <> com.db.dbworld.app.live.entity.LiveHealth.DOWN
           order by c.sortOrder asc, coalesce(c.customName, c.name) asc
           """)
    List<LiveChannelEntity> findPublicChannels();

    /**
     * The category chips. Reads the split collection rather than {@code group_title},
     * which is a {@code ;}-joined list and would otherwise offer "Culture;Family" as a
     * category alongside "Culture" and "Family".
     */
    @Query("""
           select distinct cat from LiveChannelEntity c join c.categories cat
           where c.enabled = true and c.health <> com.db.dbworld.app.live.entity.LiveHealth.DOWN
           order by cat asc
           """)
    List<String> findPublicGroups();

    long countByHealth(LiveHealth health);

    long countByEnabledTrue();

    /** Channels whose sources are all gone — left behind when a playlist is deleted. */
    @Query("""
           select c from LiveChannelEntity c
           where not exists (select 1 from LiveChannelSourceEntity s where s.channelId = c.id)
           """)
    List<LiveChannelEntity> findOrphans();

    @Query("""
           select distinct c from LiveChannelEntity c
           where (:q is null or lower(coalesce(c.customName, c.name)) like lower(concat('%', :q, '%'))
                             or exists (select 1 from LiveChannelEntity c2 join c2.categories cat
                                        where c2 = c and lower(cat) like lower(concat('%', :q, '%'))))
           order by coalesce(c.customName, c.name) asc
           """)
    List<LiveChannelEntity> search(@Param("q") String q);

    /** One channel's membership of one category. */
    record CategoryRow(String channelId, String category) {}

    /**
     * Every (channel, category) pair for the given channels, in ONE query.
     *
     * <p>{@code categories} is a lazy {@code @ElementCollection}, so reading it off an
     * entity outside a session throws {@code LazyInitializationException}, and reading it
     * inside one issues a select per channel. Neither is acceptable for a list of
     * thousands, so the mapping layer joins these rows in memory — the same shape the
     * sources already use.
     */
    @Query("""
           select new com.db.dbworld.app.live.repository.LiveChannelRepository$CategoryRow(c.id, cat)
           from LiveChannelEntity c join c.categories cat
           where c.id in :ids
           """)
    List<CategoryRow> findCategoriesFor(@Param("ids") Collection<String> ids);

    /** One channel's membership of one language. */
    record LanguageRow(String channelId, String language) {}

    /** Every (channel, language) pair for the given channels, in ONE query — see above. */
    @Query("""
           select new com.db.dbworld.app.live.repository.LiveChannelRepository$LanguageRow(c.id, lang)
           from LiveChannelEntity c join c.languages lang
           where c.id in :ids
           """)
    List<LanguageRow> findLanguagesFor(@Param("ids") Collection<String> ids);

    /* -- Home-hub counters. Scoped to what the public grid shows, so the tile cannot
       advertise channels a visitor then cannot find. ---------------------------------- */

    @Query("""
           select count(c) from LiveChannelEntity c
           where c.enabled = true and c.health <> com.db.dbworld.app.live.entity.LiveHealth.DOWN
           """)
    long countPublicChannels();

    @Query("""
           select count(distinct c.country) from LiveChannelEntity c
           where c.enabled = true and c.health <> com.db.dbworld.app.live.entity.LiveHealth.DOWN
             and c.country is not null
           """)
    long countPublicCountries();

    /**
     * A few channels with a logo, for the home tile's strip.
     *
     * <p>Requires a logo because the tile is showing pictures — a channel without one
     * would render as a grey box and make the strip look broken rather than sparse.
     */
    @Query("""
           select c from LiveChannelEntity c
           where c.enabled = true and c.health = com.db.dbworld.app.live.entity.LiveHealth.UP
             and c.logoUrl is not null
           order by c.sortOrder asc, coalesce(c.customName, c.name) asc
           """)
    List<LiveChannelEntity> findFeatured(Pageable page);
}
