package com.db.dbworld.audit.activity.repository;

import com.db.dbworld.audit.activity.entity.UserActivityLogEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;

@Repository
public interface UserActivityLogRepository extends JpaRepository<UserActivityLogEntity, Long>,
        JpaSpecificationExecutor<UserActivityLogEntity> {

    @EntityGraph(attributePaths = {"user"}) // This ensures user is fetched in same query
    default Page<UserActivityLogEntity> findByFilters(String username, String method, Integer status,
                                                      String uri, String ip, String requestId,
                                                      LocalDateTime startDate, LocalDateTime endDate,
                                                      Pageable pageable) {
        Specification<UserActivityLogEntity> spec = Specification.where(null);

        if (username != null) {
            // Update to search through user's email
            spec = spec.and((root, query, cb) ->
                    cb.like(cb.lower(root.get("user").get("email")), "%" + username.toLowerCase() + "%"));
        }

        // Rest of your specifications remain the same
        if (method != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("method"), method));
        }

        if (status != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("status"), status));
        }

        if (uri != null) {
            spec = spec.and((root, query, cb) -> cb.like(cb.lower(root.get("uri")), "%" + uri.toLowerCase() + "%"));
        }

        if (ip != null) {
            spec = spec.and((root, query, cb) -> cb.like(root.get("ip"), ip + "%"));
        }

        if (requestId != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("requestId"), requestId));
        }

        if (startDate != null && endDate != null) {
            spec = spec.and((root, query, cb) -> cb.between(root.get("timestamp"), startDate, endDate));
        }

        return findAll(spec, pageable);
    }
}
