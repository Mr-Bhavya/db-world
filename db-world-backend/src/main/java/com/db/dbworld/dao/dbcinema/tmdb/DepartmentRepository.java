package com.db.dbworld.dao.dbcinema.tmdb;

import com.db.dbworld.entities.dbcinema.tmdb.credits.DepartmentEntity;
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
public interface DepartmentRepository extends JpaRepository<DepartmentEntity, String> {

    @Query("SELECT d FROM DepartmentEntity d WHERE d.name IN :names")
    List<DepartmentEntity> findByNamesIn(@Param("names") Collection<String> names);

    default Map<String, DepartmentEntity> findMapByNames(Collection<String> names) {
//        if (names == null || names.isEmpty()) {
//            return new HashMap<>();
//        }
//        return findByNamesIn(names).stream()
//                .collect(Collectors.toMap(DepartmentEntity::getName, Function.identity()));
        return null;
    }
}
