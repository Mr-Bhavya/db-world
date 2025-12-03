package com.db.dbworld.dao.dbcinema.tmdb;

import com.db.dbworld.entities.dbcinema.tmdb.credits.JobEntity;
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
public interface JobRepository extends JpaRepository<JobEntity, String> {

    @Query("SELECT j FROM JobEntity j WHERE j.name IN :names")
    List<JobEntity> findByNamesIn(@Param("names") Collection<String> names);

    default Map<String, JobEntity> findMapByNames(Collection<String> names) {
        if (names == null || names.isEmpty()) {
            return new HashMap<>();
        }
        return findByNamesIn(names).stream()
                .collect(Collectors.toMap(JobEntity::getName, Function.identity()));
    }
}
