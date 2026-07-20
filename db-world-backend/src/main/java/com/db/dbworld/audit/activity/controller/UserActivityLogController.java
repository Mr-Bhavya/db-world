package com.db.dbworld.audit.activity.controller;

import com.db.dbworld.api.response.ApiResponse;
import com.db.dbworld.audit.activity.dto.UserActivityLogDto;
import com.db.dbworld.audit.activity.service.UserActivityLogService;
import com.db.dbworld.config.AppConstants;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@Log4j2
@RestController
@RequestMapping("/api/admin/activity-logs")
@RequiredArgsConstructor
public class UserActivityLogController {

    private final UserActivityLogService logService;

    @GetMapping
    @PreAuthorize(AppConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<Map<String, Object>> getLogs(
            @RequestParam(defaultValue = "0")    int page,
            @RequestParam(defaultValue = "50")   int size,
            @RequestParam(required = false)      String username,
            @RequestParam(required = false)      String method,
            @RequestParam(required = false)      Integer status,
            @RequestParam(required = false)      String uri,
            @RequestParam(required = false)      String ip,
            @RequestParam(required = false)      String requestId,
            @RequestParam(required = false)      String startDate,
            @RequestParam(required = false)      String endDate,
            @RequestParam(defaultValue = "timestamp") String sortBy,
            @RequestParam(defaultValue = "desc")      String sortDir) {

        log.debug("getLogs called: username={}, method={}, status={}, page={}, size={}",
                username, method, status, page, size);

        Sort.Direction dir = "asc".equalsIgnoreCase(sortDir) ? Sort.Direction.ASC : Sort.Direction.DESC;
        String safeSort = sortBy.matches("timestamp|method|status|duration|userEmail|uri|ip") ? sortBy : "timestamp";
        PageRequest pageable = PageRequest.of(page, Math.min(size, 200), Sort.by(dir, safeSort));

        LocalDateTime start = startDate != null ? LocalDateTime.parse(startDate) : null;
        LocalDateTime end   = endDate   != null ? LocalDateTime.parse(endDate)   : null;

        Page<UserActivityLogDto> result = logService
                .getFilteredLogs(username, method, status, uri, ip, requestId, start, end, pageable)
                .map(UserActivityLogDto::new);

        Map<String, Object> r = new HashMap<>();
        r.put("content",          result.getContent());
        r.put("totalElements",    result.getTotalElements());
        r.put("totalPages",       result.getTotalPages());
        r.put("page",             result.getNumber());
        r.put("size",             result.getSize());
        r.put("last",             result.isLast());
        return ApiResponse.success(r);
    }
}
