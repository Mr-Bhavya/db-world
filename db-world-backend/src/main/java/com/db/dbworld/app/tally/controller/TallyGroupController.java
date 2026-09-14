package com.db.dbworld.app.tally.controller;

import com.db.dbworld.app.tally.dto.CreateGroupRequest;
import com.db.dbworld.app.tally.dto.TallyGroupDetailDto;
import com.db.dbworld.app.tally.dto.TallyGroupSummaryDto;
import com.db.dbworld.app.tally.dto.UpdateGroupRequest;
import com.db.dbworld.app.tally.service.TallyGroupService;
import com.db.dbworld.core.context.UserContext;
import com.db.dbworld.core.role.annotations.AnyRole;
import com.db.dbworld.payloads.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Groups: the shared ledgers themselves.
 *
 * <p>There is no {@code DELETE}. With no foreign keys anywhere in the module, removing a group
 * row would orphan every member, expense, ledger entry and settlement underneath it; archiving
 * is the only removal, and it is reversible. See {@code TallyGroupEntity}.
 */
@RestController
@RequestMapping("/api/tally/groups")
@RequiredArgsConstructor
@AnyRole
public class TallyGroupController {

    private final TallyGroupService groups;
    private final UserContext userContext;

    /** Every group the caller is in, each with their own net position in it. */
    @GetMapping
    public ResponseEntity<ApiResponse<List<TallyGroupSummaryDto>>> listMine() {
        return TallyResponses.ok(groups.listMine(userContext.userId()));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<TallyGroupDetailDto>> create(
            @Valid @RequestBody CreateGroupRequest request) {
        var group = groups.create(userContext.userId(), request);
        return TallyResponses.created("Group created", group);
    }

    /** One group and its full roster, departed members included. */
    @GetMapping("/{groupId}")
    public ResponseEntity<ApiResponse<TallyGroupDetailDto>> get(@PathVariable String groupId) {
        return TallyResponses.ok(groups.get(userContext.userId(), groupId));
    }

    /**
     * Renames the group, or archives and reopens it.
     *
     * <p>Archiving while anybody is up or down answers 409 naming the amount, unless the request
     * sets {@code settleOutstandingLater}.
     */
    @PatchMapping("/{groupId}")
    public ResponseEntity<ApiResponse<TallyGroupDetailDto>> update(
            @PathVariable String groupId,
            @Valid @RequestBody UpdateGroupRequest request) {
        var group = groups.update(userContext.userId(), groupId, request);
        String message = Boolean.TRUE.equals(request.archived()) ? "Group archived"
                : Boolean.FALSE.equals(request.archived()) ? "Group reopened"
                : "Group updated";
        return TallyResponses.ok(message, group);
    }
}
