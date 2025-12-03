package com.db.dbworld.dao.dbcinema.tmdb;

import com.db.dbworld.entities.dbcinema.tmdb.ProductionCountriesEntity;
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
public interface ProductionCountriesRepository extends JpaRepository<ProductionCountriesEntity, String> {
    @Query("SELECT p FROM ProductionCountriesEntity p WHERE p.iso_3166_1 IN :codes")
    List<ProductionCountriesEntity> findByCodesIn(@Param("codes") Collection<String> codes);

    default Map<String, ProductionCountriesEntity> findMapByCodes(Collection<String> codes) {
        if (codes == null || codes.isEmpty()) {
            return new HashMap<>();
        }
        return findByCodesIn(codes).stream()
                .collect(Collectors.toMap(ProductionCountriesEntity::getIso_3166_1, Function.identity()));
    }
}
