package com.db.dbworld.audit.activity.repository;

import com.db.dbworld.audit.activity.entity.UserActivityLogEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;

@Repository
public interface UserActivityLogRepository
        extends JpaRepository<UserActivityLogEntity, Long>,
                JpaSpecificationExecutor<UserActivityLogEntity> {

    default Page<UserActivityLogEntity> findByFilters(
            String username, String method, Integer status,
            String uri, String ip, String requestId,
            LocalDateTime startDate, LocalDateTime endDate,
            Pageable pageable) {

        Specification<UserActivityLogEntity> spec = Specification.where(null);

        if (username != null && !username.isBlank()) {
            spec = spec.and((root, q, cb) ->
                    cb.like(cb.lower(root.get("userEmail")), "%" + username.toLowerCase() + "%"));
        }
        if (method != null && !method.isBlank()) {
            spec = spec.and((root, q, cb) -> cb.equal(root.get("method"), method.toUpperCase()));
        }
        if (status != null) {
            spec = spec.and((root, q, cb) -> cb.equal(root.get("status"), status));
        }
        if (uri != null && !uri.isBlank()) {
            spec = spec.and((root, q, cb) ->
                    cb.like(cb.lower(root.get("uri")), "%" + uri.toLowerCase() + "%"));
        }
        if (ip != null && !ip.isBlank()) {
            spec = spec.and((root, q, cb) ->
                    cb.like(root.get("ip"), ip + "%"));
        }
        if (requestId != null && !requestId.isBlank()) {
            spec = spec.and((root, q, cb) -> cb.equal(root.get("requestId"), requestId));
        }
        if (startDate != null) {
            spec = spec.and((root, q, cb) -> cb.greaterThanOrEqualTo(root.get("timestamp"), startDate));
        }
        if (endDate != null) {
            spec = spec.and((root, q, cb) -> cb.lessThanOrEqualTo(root.get("timestamp"), endDate));
        }

        return findAll(spec, pageable);
    }
}
