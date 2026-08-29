package com.db.dbworld.core.push;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface PushDeviceTokenRepository extends JpaRepository<PushDeviceTokenEntity, Long> {

    Optional<PushDeviceTokenEntity> findByToken(String token);

    void deleteByToken(String token);

    /** Every device token belonging to any of the given users — for targeted (per-user) pushes. */
    List<PushDeviceTokenEntity> findByUserIdIn(Collection<Long> userIds);

    /** Drops every push registration for a user — on logout-everywhere, reset or deletion. */
    long deleteByUserId(Long userId);
}
