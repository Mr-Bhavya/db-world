package com.db.dbworld.dao.dbcinema.tmdb;

import com.db.dbworld.entities.dbcinema.tmdb.credits.CharacterEntity;
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
public interface CharacterRepository extends JpaRepository<CharacterEntity, String> {

    @Query("SELECT c FROM CharacterEntity c WHERE c.name IN :names")
    List<CharacterEntity> findByNamesIn(@Param("names") Collection<String> names);

    // Optional: Create a method that returns a Map for easier usage
    default Map<String, CharacterEntity> findMapByNames(Collection<String> names) {
        if (names == null || names.isEmpty()) {
            return new HashMap<>();
        }
        return findByNamesIn(names).stream()
                .collect(Collectors.toMap(CharacterEntity::getName, Function.identity()));
    }
}
