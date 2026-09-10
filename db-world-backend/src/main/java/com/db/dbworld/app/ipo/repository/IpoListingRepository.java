package com.db.dbworld.app.ipo.repository;

import com.db.dbworld.app.ipo.entity.IpoListingEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface IpoListingRepository extends JpaRepository<IpoListingEntity, String> {
    Optional<IpoListingEntity> findByMatchKey(String matchKey);

    List<IpoListingEntity> findByStatus(String status);

    /**
     * IPOs of a given status whose close date falls within {@code [from, to]} and that haven't had
     * a "closing soon" reminder sent yet — the candidate set for the closing-soon push.
     */
    List<IpoListingEntity> findByStatusAndCloseDateBetweenAndClosingSoonNotifiedAtIsNull(
            String status, LocalDate from, LocalDate to);

    /**
     * Live rows sharing a resolution key — the duplicate candidates for one company. Merged-away
     * tombstones are excluded so a second merge pass can't re-propose a cluster it already settled.
     * Ordered oldest-first so callers get a stable, deterministic survivor.
     */
    @Query("""
            select l from IpoListingEntity l
            where l.aliasKey = :aliasKey and l.mergedIntoId is null
            order by l.firstSeenAt asc, l.id asc
            """)
    List<IpoListingEntity> findLiveByAliasKey(String aliasKey);

    /**
     * Every resolution key held by more than one live row — i.e. the duplicate clusters, and
     * nothing else. Done in SQL so the duplicate report never loads the whole table to find the
     * handful of keys that are actually in conflict.
     */
    @Query("""
            select l.aliasKey from IpoListingEntity l
            where l.aliasKey is not null and l.mergedIntoId is null
            group by l.aliasKey
            having count(l.id) > 1
            """)
    List<String> findDuplicateAliasKeys();

    /** Every row not merged away — the only rows the list, the GMP refresh and matching may see. */
    @Query("select l from IpoListingEntity l where l.mergedIntoId is null")
    List<IpoListingEntity> findAllLive();

    /** Rows whose {@code aliasKey} has never been computed — the backfill candidate set. */
    List<IpoListingEntity> findByAliasKeyIsNull();
}
