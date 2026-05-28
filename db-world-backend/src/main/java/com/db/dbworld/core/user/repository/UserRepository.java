package com.db.dbworld.core.user.repository;

import com.db.dbworld.core.role.enums.Role;
import com.db.dbworld.core.user.entity.UserEntity;
import com.db.dbworld.core.user.projection.UserSearchProjection;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
public interface UserRepository extends JpaRepository<UserEntity, Long>, JpaSpecificationExecutor<UserEntity> {

    Optional<UserEntity> findByEmail(String email);

    @Query(value = "SELECT role FROM new_db_world.USERS WHERE id= :id", nativeQuery = true)
    Integer getRoleByUserId(@Param(value="id") Integer id);

//    @Query(value = """
//        SELECT
//            u.first_name as firstName,
//            u.last_name as lastName,
//            u.email
//        FROM
//            new_db_world.users u
//        WHERE
//            LOWER(u.first_name) LIKE LOWER(CONCAT('%', :query, '%')) OR
//            LOWER(u.last_name) LIKE LOWER(CONCAT('%', :query, '%')) OR
//            LOWER(u.email) LIKE LOWER(CONCAT('%', :query, '%'))
//        LIMIT :limit
//        """, nativeQuery = true)
//    List<UserSearchProjection> searchUsers(@Param("query") String query, @Param("limit") int limit);

    @Query("""
    SELECT u.userId AS userId,
           u.firstName AS firstName,
           u.lastName AS lastName,
           u.email AS email
    FROM UserEntity u
    WHERE LOWER(u.firstName) LIKE LOWER(CONCAT('%', :query, '%'))
       OR LOWER(u.lastName) LIKE LOWER(CONCAT('%', :query, '%'))
       OR LOWER(u.email) LIKE LOWER(CONCAT('%', :query, '%'))
""")
    List<UserSearchProjection> searchUsers(@Param("query") String query, Pageable pageable);

    long countByRoleName(Role roleName);

    /**
     * Every active user id except the actor. Used to broadcast review notifications
     * across the whole user base (small home-server scale, not 10k+ users).
     */
    @Query("""
           SELECT u.userId FROM UserEntity u
           WHERE u.userId <> :actorId
             AND u.enabled = true
             AND u.accountNonLocked = true
           """)
    List<Long> findActiveUserIdsExcept(@Param("actorId") Long actorId);
}
