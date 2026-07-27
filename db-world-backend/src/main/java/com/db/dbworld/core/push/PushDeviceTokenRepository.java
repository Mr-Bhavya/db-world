package com.db.dbworld.core.push;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PushDeviceTokenRepository extends JpaRepository<PushDeviceTokenEntity, Long> {

    Optional<PushDeviceTokenEntity> findByToken(String token);

    void deleteByToken(String token);
}
