package com.db.dbworld.dao.dbcinema.tmdb;

import com.db.dbworld.entities.dbcinema.tmdb.credits.PersonEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Repository
public interface PersonRepository extends JpaRepository<PersonEntity, Long> {

    @Query("SELECT p FROM PersonEntity p WHERE p.id IN :ids")
    List<PersonEntity> findByIdsIn(@Param("ids") Collection<Long> ids);

    default Map<Long, PersonEntity> findMapByIds(Collection<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            return new HashMap<>();
        }
        return findByIdsIn(ids).stream()
                .collect(Collectors.toMap(PersonEntity::getId, Function.identity()));
    }
}
