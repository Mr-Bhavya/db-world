package com.db.dbworld.dao.dbcinema.tmdb;

import com.db.dbworld.entities.dbcinema.tmdb.SpokenLanguageEntity;
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
public interface SpokenLanguageRepository extends JpaRepository<SpokenLanguageEntity, String> {
    @Query("SELECT s FROM SpokenLanguageEntity s WHERE s.iso_639_1 IN :codes")
    List<SpokenLanguageEntity> findByCodesIn(@Param("codes") Collection<String> codes);

    default Map<String, SpokenLanguageEntity> findMapByCodes(Collection<String> codes) {
        if (codes == null || codes.isEmpty()) {
            return new HashMap<>();
        }
        return findByCodesIn(codes).stream()
                .collect(Collectors.toMap(SpokenLanguageEntity::getIso_639_1, Function.identity()));
    }
}
