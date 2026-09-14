package com.db.dbworld.app.tally.repository;

import com.db.dbworld.app.tally.entity.TallyGroupEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface TallyGroupRepository extends JpaRepository<TallyGroupEntity, String> {

    /**
     * Loads the groups a membership lookup already resolved.
     *
     * <p>Deliberately not a join from {@code tally_group_member}: membership is resolved first
     * through {@code idx_tally_group_member_user}, and the ids come back here. Keeping the two
     * steps apart means the authorization decision — am I a member — happens in one place
     * rather than being smuggled into the join condition of every read.
     */
    List<TallyGroupEntity> findByIdIn(Collection<String> ids);

    /**
     * A group only if it is still open for writes.
     *
     * <p>Mutating paths use this rather than {@code findById}, because the archived check has to
     * happen on the write and not on the read: check it only when displaying and an expense can
     * still be posted into an archived group, where nobody will ever see it again.
     */
    @Query("select g from TallyGroupEntity g where g.id = :id and g.archivedAt is null")
    Optional<TallyGroupEntity> findOpenById(@Param("id") String id);
}
