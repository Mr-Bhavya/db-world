package com.db.dbworld.app.tally.controller;

import com.db.dbworld.api.response.ApiResponse;
import com.db.dbworld.app.tally.dto.RecordSettlementRequest;
import com.db.dbworld.app.tally.dto.SettleUpTransferDto;
import com.db.dbworld.app.tally.dto.TallySettlementDto;
import com.db.dbworld.app.tally.service.TallySettlementService;
import com.db.dbworld.core.context.UserContext;
import com.db.dbworld.core.role.annotations.AnyRole;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Settlements: the money going back.
 *
 * <p>Same two-base-path split as expenses — recording and listing belong to a group, acting on
 * one settlement is addressed by its own id.
 */
@RestController
@RequiredArgsConstructor
@AnyRole
public class TallySettlementController {

    private final TallySettlementService settlements;
    private final UserContext userContext;

    /** The group's payments, most recent first. Reversed ones are not listed. */
    @GetMapping("/api/tally/groups/{groupId}/settlements")
    public ResponseEntity<ApiResponse<List<TallySettlementDto>>> list(@PathVariable String groupId) {
        return TallyResponses.ok(settlements.list(userContext.userId(), groupId));
    }

    /**
     * Records a payment between two members.
     *
     * <p>Send an {@code idempotencyKey}. Settlement is one-sided, so a duplicate is not a
     * cosmetic second row — it moves the balance by the full amount again, and the payer ends up
     * looking like they overpaid.
     */
    @PostMapping("/api/tally/groups/{groupId}/settlements")
    public ResponseEntity<ApiResponse<TallySettlementDto>> record(
            @PathVariable String groupId,
            @Valid @RequestBody RecordSettlementRequest request) {
        var settlement = settlements.record(userContext.userId(), groupId, request);
        return TallyResponses.created("Payment recorded", settlement);
    }

    /**
     * Takes a payment back.
     *
     * <p>Flags the row and writes a reversal entry; nothing is deleted. Whoever recorded it may
     * undo it, anybody else needs the owner role — mistyping your own payment is the ordinary
     * case and should not need somebody else's help.
     */
    @DeleteMapping("/api/tally/settlements/{settlementId}")
    public ResponseEntity<ApiResponse<TallySettlementDto>> reverse(@PathVariable String settlementId) {
        var settlement = settlements.reverse(userContext.userId(), settlementId);
        return TallyResponses.ok("Payment reversed", settlement);
    }

    /**
     * A suggested set of payments that would clear the group.
     *
     * <p><b>A GET, and it writes nothing.</b> The plan is advice: acting on one of these is an
     * ordinary POST to {@code /settlements} like any other payment, and the ledger keeps the
     * true pairwise debts underneath. That is the difference from Splitwise, which rewrites who
     * owes whom and so can tell you to settle up with somebody you never borrowed from.
     */
    @GetMapping("/api/tally/groups/{groupId}/settle-up")
    public ResponseEntity<ApiResponse<List<SettleUpTransferDto>>> settleUpPlan(@PathVariable String groupId) {
        return TallyResponses.ok(settlements.settleUpPlan(userContext.userId(), groupId));
    }
}
