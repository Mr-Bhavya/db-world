package com.db.dbworld.app.ipo.service;

import com.db.dbworld.app.ipo.entity.IpoSourcePollEntity;
import com.db.dbworld.app.ipo.repository.IpoSourcePollRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Objects;
import java.util.Optional;

/**
 * Upserts per-source poll health into {@code ipo_source_poll}, keyed by the source's own key.
 * Used by {@code IpoPollScheduler} to record whether each enabled {@code IpoSource} answered on
 * the last poll cycle, and to drive the admin monitor's "last updated" stamp.
 */
@Service
public class IpoSourcePollService {

    private static final String STATUS_OK = "OK";

    private final IpoSourcePollRepository repository;

    public IpoSourcePollService(IpoSourcePollRepository repository) {
        this.repository = repository;
    }

    /** Upsert: lastPolledAt/lastSuccessAt = now, lastStatus = OK, consecutiveFailures reset to 0. */
    @Transactional
    public void recordSuccess(String source, Instant now) {
        IpoSourcePollEntity entity = findOrCreate(source);
        entity.setLastPolledAt(now);
        entity.setLastSuccessAt(now);
        entity.setLastStatus(STATUS_OK);
        entity.setConsecutiveFailures(0);
        repository.save(entity);
    }

    /** Upsert: lastPolledAt = now, lastStatus = status, consecutiveFailures++. lastSuccessAt is left untouched. */
    @Transactional
    public void recordFailure(String source, Instant now, String status) {
        IpoSourcePollEntity entity = findOrCreate(source);
        entity.setLastPolledAt(now);
        entity.setLastStatus(status);
        entity.setConsecutiveFailures(entity.getConsecutiveFailures() + 1);
        repository.save(entity);
    }

    /** Max {@code lastSuccessAt} across every tracked source; empty if no source has ever succeeded. */
    public Optional<Instant> lastSuccessAcrossSources() {
        return repository.findAll().stream()
                .map(IpoSourcePollEntity::getLastSuccessAt)
                .filter(Objects::nonNull)
                .max(Instant::compareTo);
    }

    private IpoSourcePollEntity findOrCreate(String source) {
        return repository.findById(source)
                .orElseGet(() -> IpoSourcePollEntity.builder().source(source).consecutiveFailures(0).build());
    }
}
