package com.db.dbworld.app.ipo.repository;

import com.db.dbworld.app.ipo.entity.IpoListingEntity;
import org.springframework.data.jpa.repository.JpaRepository;

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
}
