package com.db.dbworld.app.tally.service;

import com.db.dbworld.app.tally.dto.RecordSettlementRequest;
import com.db.dbworld.app.tally.dto.SettleUpTransferDto;
import com.db.dbworld.app.tally.dto.TallySettlementDto;
import com.db.dbworld.app.tally.entity.TallyGroupKind;
import com.db.dbworld.app.tally.entity.TallyGroupMemberEntity;
import com.db.dbworld.app.tally.entity.TallyLedgerSourceType;
import com.db.dbworld.app.tally.entity.TallySettlementEntity;
import com.db.dbworld.app.tally.entity.TallySettlementStatus;
import com.db.dbworld.app.tally.mapper.TallyMapper;
import com.db.dbworld.app.tally.repository.TallyGroupMemberRepository;
import com.db.dbworld.app.tally.repository.TallySettlementRepository;
import com.db.dbworld.core.exception.DbWorldException;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

/**
 * Recording and undoing payments between members.
 *
 * <p>Settling is an ordinary write. The settle-up plan only ever <em>suggests</em> transfers;
 * acting on one comes back through here like any other payment, which is what keeps the ledger a
 * record of what actually happened rather than of what somebody was advised to do.
 */
@Log4j2
@Service
@RequiredArgsConstructor
public class TallySettlementService {

    private final TallyAccessService access;
    private final TallyBalanceService balances;
    private final TallyLedgerService ledgerService;
    private final TallySettlementRepository settlements;
    private final TallyGroupMemberRepository members;
    private final TallyActivityService activity;
    private final TallyMapper mapper;

    /* ============================== record ============================== */

    /**
     * Records a payment and posts it to the ledger.
     *
     * <p>The idempotency check comes first, before any validation. A retry has to return the
     * original rather than validate, proceed, and then collide on
     * {@code uk_tally_settlement_group_idem} as a 500 — and because settlement is one-sided, a
     * duplicate here is not a cosmetic double row. It moves the balance by the full amount a
     * second time, so the payer appears to have overpaid and the debt they were clearing looks
     * like it has flipped.
     */
    @Transactional
    public TallySettlementDto record(Long userId, String groupId, RecordSettlementRequest request) {
        var group = access.requireOpenGroup(userId, groupId);
        if (group.getKind() == TallyGroupKind.PERSONAL) {
            // Nobody to pay and nobody to be paid: a personal ledger is always at zero by
            // construction, and a payment here could only push it off zero.
            throw new DbWorldException(HttpStatus.CONFLICT,
                    "There is nobody to settle up with in your own spending");
        }

        if (request.idempotencyKey() != null && !request.idempotencyKey().isBlank()) {
            var replay = settlements.findByGroupIdAndIdempotencyKey(groupId, request.idempotencyKey());
            if (replay.isPresent()) {
                log.debug("Replaying settlement {} for idempotency key {}",
                        replay.get().getId(), request.idempotencyKey());
                return mapper.toSettlementDto(replay.get());
            }
        }

        if (request.fromMemberId().equals(request.toMemberId())) {
            throw new DbWorldException(HttpStatus.BAD_REQUEST, "A payment needs two different people");
        }
        var from = requireActiveMember(groupId, request.fromMemberId());
        var to = requireActiveMember(groupId, request.toMemberId());

        var settlement = new TallySettlementEntity();
        settlement.setGroupId(groupId);
        settlement.setFromMemberId(from.getId());
        settlement.setToMemberId(to.getId());
        settlement.setAmount(request.amount());
        settlement.setMethod(blankToNull(request.method()));
        settlement.setSettledAt(request.settledAt() == null ? Instant.now() : request.settledAt());
        settlement.setRecordedByUserId(userId);
        settlement.setIdempotencyKey(blankToNull(request.idempotencyKey()));
        settlements.save(settlement);

        ledgerService.postSettlement(settlement);
        activity.settlementRecorded(settlement, from.getDisplayName(), to.getDisplayName(), userId);

        log.debug("Recorded settlement {} of {} from {} to {}",
                settlement.getId(), settlement.getAmount(), from.getId(), to.getId());
        return mapper.toSettlementDto(settlement);
    }

    /* ============================== reverse ============================== */

    /**
     * Takes a payment back, by flagging it and writing a reversal entry.
     *
     * <p>The counterweight to settlement being one-sided: nobody confirms a payment from the
     * other end, so a mistyped amount is otherwise permanent and the only way to correct it
     * would be a second, fictional payment in the opposite direction. The row is kept and its
     * status changes, so the history reads as "this was recorded and then taken back" rather
     * than as two real payments that never happened.
     *
     * <p>Whoever recorded it may reverse it; anybody else needs the owner role. Somebody
     * mistyping their own payment is the ordinary case and should not need to find an owner.
     */
    @Transactional
    public TallySettlementDto reverse(Long userId, String settlementId) {
        var settlement = settlements.findById(settlementId)
                .orElseThrow(() -> new DbWorldException(HttpStatus.NOT_FOUND, "Settlement not found"));
        access.requireOpenGroup(userId, settlement.getGroupId());

        if (!settlement.getRecordedByUserId().equals(userId)) {
            access.requireOwner(userId, settlement.getGroupId());
        }
        if (settlement.getStatus() != TallySettlementStatus.ACTIVE) {
            throw new DbWorldException(HttpStatus.CONFLICT, "This payment has already been reversed");
        }

        settlement.setStatus(TallySettlementStatus.REVERSED);
        ledgerService.reverse(TallyLedgerSourceType.SETTLEMENT, settlement.getId());
        activity.settlementReversed(settlement,
                nameOf(settlement.getGroupId(), settlement.getFromMemberId()),
                nameOf(settlement.getGroupId(), settlement.getToMemberId()), userId);

        log.debug("Reversed settlement {}", settlement.getId());
        return mapper.toSettlementDto(settlement);
    }

    /* ============================== read ============================== */

    /** The group's payments, most recent first. Reversed ones are excluded. */
    @Transactional(readOnly = true)
    public List<TallySettlementDto> list(Long userId, String groupId) {
        access.requireVisibleGroup(userId, groupId);
        return mapper.toSettlementDtos(
                settlements.findByGroupIdAndStatusOrderBySettledAtDesc(groupId, TallySettlementStatus.ACTIVE));
    }

    /**
     * A suggested set of payments that would clear the group.
     *
     * <p>Read-only, and worth saying twice: nothing here writes. Splitwise's equivalent rewrites
     * who owes whom, which is how you end up being told to settle up with somebody you never
     * borrowed from.
     */
    @Transactional(readOnly = true)
    public List<SettleUpTransferDto> settleUpPlan(Long userId, String groupId) {
        access.requireVisibleGroup(userId, groupId);
        return balances.settleUpPlan(groupId);
    }

    /* ============================== shared ============================== */

    /**
     * A member who can still be paid.
     *
     * <p>Both ends must be active. Somebody who has left is necessarily at zero — that is what
     * removal required — so a payment naming them would be settling a debt that does not exist,
     * and would push their balance off zero where nothing can bring it back.
     */
    private TallyGroupMemberEntity requireActiveMember(String groupId, String memberId) {
        return members.findByIdAndGroupId(memberId, groupId)
                .filter(TallyGroupMemberEntity::isActive)
                .orElseThrow(() -> new DbWorldException(HttpStatus.BAD_REQUEST,
                        "That person is not in this group"));
    }

    /** A member's name for the log, falling back rather than failing if they are gone. */
    private String nameOf(String groupId, String memberId) {
        return members.findByIdAndGroupId(memberId, groupId)
                .map(TallyGroupMemberEntity::getDisplayName)
                .orElse("someone");
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
