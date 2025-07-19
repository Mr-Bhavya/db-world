package com.db.dbworld.dao.user;

import com.db.dbworld.entities.dbcinema.user.UserSearchProjection;
import com.db.dbworld.entities.user.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.awt.print.Pageable;
import java.util.List;
import java.util.Optional;
public interface UserRepository extends JpaRepository<UserEntity, Long> {

    Optional<UserEntity> findByEmail(String email);

    @Query(value = "SELECT role FROM DB_WORLD.USERS WHERE id= :id", nativeQuery = true)
    Integer getRoleByUserId(@Param(value="id") Integer id);

    @Query(value = """
        SELECT
            u.firstName as firstName,
            u.lastName as lastName,
            u.email
        FROM
            db_world.users u
        WHERE
            LOWER(u.firstName) LIKE LOWER(CONCAT('%', :query, '%')) OR
            LOWER(u.lastName) LIKE LOWER(CONCAT('%', :query, '%')) OR
            LOWER(u.email) LIKE LOWER(CONCAT('%', :query, '%'))
        LIMIT :limit
        """, nativeQuery = true)
    List<UserSearchProjection> searchUsers(@Param("query") String query, @Param("limit") int limit);

}
