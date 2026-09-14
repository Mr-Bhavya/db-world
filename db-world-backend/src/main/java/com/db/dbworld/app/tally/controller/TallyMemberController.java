package com.db.dbworld.app.tally.controller;

import com.db.dbworld.app.tally.dto.AddMemberRequest;
import com.db.dbworld.app.tally.dto.TallyMemberDto;
import com.db.dbworld.app.tally.dto.UpdateMemberRequest;
import com.db.dbworld.app.tally.service.TallyMemberService;
import com.db.dbworld.core.context.UserContext;
import com.db.dbworld.core.role.annotations.AnyRole;
import com.db.dbworld.payloads.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * The roster of one group.
 *
 * <p>Members are found with the existing {@code GET /api/users/search?q=} before being added;
 * this module deliberately exposes no user search of its own, so there is one place in db-world
 * that decides what one user may learn about another.
 */
@RestController
@RequestMapping("/api/tally/groups/{groupId}/members")
@RequiredArgsConstructor
@AnyRole
public class TallyMemberController {

    private final TallyMemberService members;
    private final UserContext userContext;

    /**
     * Adds a db-world account, or a ghost with just a name.
     *
     * <p>Answers 201 for somebody genuinely new and for a rejoin alike. A rejoin reuses the
     * original row rather than inserting one — see {@code TallyMemberService.add} — but from the
     * caller's side the outcome is the same: this person is now in the group.
     */
    @PostMapping
    public ResponseEntity<ApiResponse<TallyMemberDto>> add(
            @PathVariable String groupId,
            @Valid @RequestBody AddMemberRequest request) {
        var member = members.add(userContext.userId(), groupId, request);
        return TallyResponses.created("%s added to the group".formatted(member.displayName()), member);
    }

    /** Renames a member, changes their role, or sets who settles their shares. */
    @PatchMapping("/{memberId}")
    public ResponseEntity<ApiResponse<TallyMemberDto>> update(
            @PathVariable String groupId,
            @PathVariable String memberId,
            @Valid @RequestBody UpdateMemberRequest request) {
        var member = members.update(userContext.userId(), groupId, memberId, request);
        return TallyResponses.ok("%s updated".formatted(member.displayName()), member);
    }

    /**
     * Takes somebody off the roster.
     *
     * <p>Answers <b>409</b> while their balance is anything but exactly zero, with the amount in
     * the message. (The plan sketched 410 here; 409 Conflict is the accurate code — the request
     * is refused because of the current state, not because the member is gone.)
     *
     * <p>Returns the member rather than an empty body: the row survives as {@code LEFT} so their
     * name keeps rendering on the history they are part of, and the caller should see that.
     */
    @DeleteMapping("/{memberId}")
    public ResponseEntity<ApiResponse<TallyMemberDto>> remove(
            @PathVariable String groupId,
            @PathVariable String memberId) {
        var member = members.remove(userContext.userId(), groupId, memberId);
        return TallyResponses.ok("%s left the group".formatted(member.displayName()), member);
    }

    /**
     * Takes over a ghost as yourself, folding its history into your own membership.
     *
     * <p>200 rather than 201: nothing is created. Two member rows that were always one person
     * become one, and the response is the surviving member with the merged balance.
     */
    @PostMapping("/{memberId}/claim")
    public ResponseEntity<ApiResponse<TallyMemberDto>> claim(
            @PathVariable String groupId,
            @PathVariable String memberId) {
        var member = members.claim(userContext.userId(), groupId, memberId);
        return TallyResponses.ok("Claimed — that history is now yours", member);
    }
}
