package com.db.dbworld.app.ipo.repository;

import com.db.dbworld.app.ipo.entity.IpoListingEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface IpoListingRepository extends JpaRepository<IpoListingEntity, String> {
    Optional<IpoListingEntity> findByMatchKey(String matchKey);

    /**
     * Listings whose matchKey starts with {@code prefix} — used with a {@code "<normalized name>|"}
     * prefix to find an IPO by company name alone, ignoring the open date the key also encodes.
     */
    List<IpoListingEntity> findByMatchKeyStartingWith(String prefix);
    List<IpoListingEntity> findByStatus(String status);

    /**
     * IPOs of a given status whose close date falls within {@code [from, to]} and that haven't had
     * a "closing soon" reminder sent yet — the candidate set for the closing-soon push.
     */
    List<IpoListingEntity> findByStatusAndCloseDateBetweenAndClosingSoonNotifiedAtIsNull(
            String status, LocalDate from, LocalDate to);
}
