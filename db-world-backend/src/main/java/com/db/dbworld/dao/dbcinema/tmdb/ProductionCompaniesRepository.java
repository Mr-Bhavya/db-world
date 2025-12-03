package com.db.dbworld.dao.dbcinema.tmdb;

import com.db.dbworld.entities.dbcinema.tmdb.ProductionCompaniesEntity;
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
public interface ProductionCompaniesRepository extends JpaRepository<ProductionCompaniesEntity, Integer> {
    @Query("SELECT p FROM ProductionCompaniesEntity p WHERE p.id IN :ids")
    List<ProductionCompaniesEntity> findByIdsIn(@Param("ids") Collection<Integer> ids);

    default Map<Integer, ProductionCompaniesEntity> findMapByIds(Collection<Integer> ids) {
        if (ids == null || ids.isEmpty()) {
            return new HashMap<>();
        }
        return findByIdsIn(ids).stream()
                .collect(Collectors.toMap(ProductionCompaniesEntity::getId, Function.identity()));
    }
}
