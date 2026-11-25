package com.db.dbworld.app.ipo.service;

import com.db.dbworld.app.ipo.entity.IpoListingEntity;
import com.db.dbworld.app.ipo.repository.IpoListingRepository;
import com.db.dbworld.core.exception.DbWorldException;
import org.springframework.http.HttpStatus;

final class IpoMergeResolver {
    private static final int MAX_HOPS = 5;

    private IpoMergeResolver() {}

    static IpoListingEntity resolve(IpoListingRepository repository, IpoListingEntity entity) {
        int hops = 0;
        while (entity.getMergedIntoId() != null) {
            if (hops++ >= MAX_HOPS) {
                throw new DbWorldException(HttpStatus.CONFLICT, "IPO merge chain is invalid");
            }
            entity = repository.findById(entity.getMergedIntoId())
                    .orElseThrow(() -> new DbWorldException(HttpStatus.NOT_FOUND, "Merged IPO survivor not found"));
        }
        return entity;
    }

    static String resolveIdIfPresent(IpoListingRepository repository, String id) {
        return repository.findById(id).map(entity -> resolve(repository, entity).getId()).orElse(id);
    }
}
