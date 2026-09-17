package com.db.dbworld.app.tally.service;

import com.db.dbworld.app.tally.dto.CreateExpenseRequest;
import com.db.dbworld.app.tally.dto.CreateLoanRequest;
import com.db.dbworld.app.tally.dto.TallyLoanDirection;
import com.db.dbworld.app.tally.dto.TallyLoanDto;
import com.db.dbworld.app.tally.entity.TallyExpenseEntity;
import com.db.dbworld.app.tally.entity.TallyExpensePayerEntity;
import com.db.dbworld.app.tally.entity.TallyExpenseShareEntity;
import com.db.dbworld.app.tally.entity.TallyExpenseKind;
import com.db.dbworld.app.tally.entity.TallyGroupEntity;
import com.db.dbworld.app.tally.entity.TallyGroupKind;
import com.db.dbworld.app.tally.entity.TallyGroupMemberEntity;
import com.db.dbworld.app.tally.entity.TallyMemberStatus;
import com.db.dbworld.app.tally.entity.TallyMethod;
import com.db.dbworld.app.tally.repository.TallyExpensePayerRepository;
import com.db.dbworld.app.tally.repository.TallyExpenseRepository;
import com.db.dbworld.app.tally.repository.TallyExpenseShareRepository;
import com.db.dbworld.app.tally.repository.TallyGroupMemberRepository;
import com.db.dbworld.app.tally.repository.TallyGroupRepository;
import com.db.dbworld.app.tally.repository.TallyLedgerEntryRepository.MemberTotal;
import com.db.dbworld.app.tally.repository.TallySettlementRepository;
import com.db.dbworld.core.exception.DbWorldException;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Money lent and borrowed between two people, and how much of it has come back.
 *
 * <h2>A loan is an expense, and that is the point</h2>
 * Nothing here writes its own ledger rows. A loan goes through
 * {@link TallyExpenseService#createEntity} as an expense of the full amount, paid by one person
 * and consumed entirely by the other, flagged {@link TallyExpenseKind#LOAN}. That is not a trick:
 * a loan and a shared bill move the balance in exactly the same way, so sharing the write path is
 * what makes balances, the settle-up plan, corrections, voiding and the activity log work on a
 * loan without any of them being taught about loans.
 *
 * <p>What the flag buys is a NAME, and the two things a name makes possible: keeping loans out of
 * every spending figure -- handing over a thousand rupees is not consumption by either side -- and
 * asking "what have I lent out" separately from "what am I owed for dinners".
 *
 * <h2>Progress, which the ledger could not previously express</h2>
 * A repayment names the loan it repays, so principal and repayments are two facts about one loan
 * rather than a single netted balance. Without that, "I lent 1,000 and got 500 back" and "I lent
 * 500" are the same number and indistinguishable. The balance was always right; it was the
 * progress that could not be told. See {@code TallySettlementEntity#settlesExpenseId}.
 */
@Log4j2
@Service
public class TallyLoanService {

    private final TallyAccessService access;
    private final TallyExpenseService expenseService;
    private final TallyExpenseRepository expenses;
    private final TallyExpensePayerRepository payers;
    private final TallyExpenseShareRepository shares;
    private final TallyGroupMemberRepository members;
    private final TallyGroupRepository groups;
    private final TallySettlementRepository settlements;
    private final Clock clock;

    /** Due dates are read against the reader's day, and this app's readers are in India. */
    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");

    @Autowired
    public TallyLoanService(TallyAccessService access,
                            TallyExpenseService expenseService,
                            TallyExpenseRepository expenses,
                            TallyExpensePayerRepository payers,
                            TallyExpenseShareRepository shares,
                            TallyGroupMemberRepository members,
                            TallyGroupRepository groups,
                            TallySettlementRepository settlements) {
        this(access, expenseService, expenses, payers, shares, members, groups, settlements,
                Clock.systemUTC());
    }

    /** Test-friendly constructor with an injectable clock, so "overdue" is deterministic. */
    TallyLoanService(TallyAccessService access,
                     TallyExpenseService expenseService,
                     TallyExpenseRepository expenses,
                     TallyExpensePayerRepository payers,
                     TallyExpenseShareRepository shares,
                     TallyGroupMemberRepository members,
                     TallyGroupRepository groups,
                     TallySettlementRepository settlements,
                     Clock clock) {
        this.access = access;
        this.expenseService = expenseService;
        this.expenses = expenses;
        this.payers = payers;
        this.shares = shares;
        this.members = members;
        this.groups = groups;
        this.settlements = settlements;
        this.clock = clock;
    }

    /* ============================== create ============================== */

    /**
     * Records money lent or borrowed.
     *
     * <p>The direction decides who pays and who owes, which is the whole of the translation from
     * "I lent Riya 1,000" into the ledger's terms. Getting it backwards would silently invert a
     * debt, so it is derived once, here, rather than being left to a client to assemble payers and
     * shares correctly.
     */
    @Transactional
    public TallyLoanDto create(Long userId, String groupId, CreateLoanRequest request) {
        TallyGroupEntity group = access.requireOpenGroup(userId, groupId);
        if (group.getKind() == TallyGroupKind.PERSONAL) {
            // Your own spending has one member. There is nobody to lend to, and a loan to
            // yourself would post both sides of the ledger against the same person.
            throw new DbWorldException(HttpStatus.CONFLICT,
                    "There is nobody to lend to in your own spending");
        }

        TallyGroupMemberEntity me = access.requireMembership(userId, groupId);
        TallyGroupMemberEntity them = members
                .findByIdAndGroupId(request.counterpartyMemberId(), groupId)
                .orElseThrow(() -> new DbWorldException(HttpStatus.NOT_FOUND,
                        "That person is not in this ledger"));

        if (them.getId().equals(me.getId())) {
            throw new DbWorldException(HttpStatus.BAD_REQUEST, "A loan needs two different people");
        }
        if (them.getStatus() != TallyMemberStatus.ACTIVE) {
            throw new DbWorldException(HttpStatus.CONFLICT,
                    "%s has left this ledger".formatted(them.getDisplayName()));
        }
        if (request.dueDate() != null && request.dueDate().isBefore(request.loanDate())) {
            // Not pedantry: an already-overdue loan would arrive flagged red, which reads as a
            // data error rather than as the deliberate backdating it probably was.
            throw new DbWorldException(HttpStatus.BAD_REQUEST,
                    "The due date cannot be before the day the money moved");
        }

        boolean lent = request.direction() == TallyLoanDirection.LENT;
        TallyGroupMemberEntity payer = lent ? me : them;
        TallyGroupMemberEntity owes  = lent ? them : me;

        // The description is what the activity log and the expense list will show, so it is
        // written as the sentence a reader wants rather than as a label plus a note they have to
        // open. The note, if there is one, is the reason -- not the shape of the transaction.
        String description = (lent ? "Lent to " : "Borrowed from ") + them.getDisplayName();

        var expenseRequest = new CreateExpenseRequest(
                description,
                request.amount(),
                // EXACT, not EQUAL: one participant carrying the full amount is an exact split of
                // one, and storing EQUAL would make a re-opened loan look like a two-way split.
                TallyMethod.EXACT,
                null,                       // no category: nothing was bought
                request.loanDate(),
                blankToNull(request.note()),
                blankToNull(request.idempotencyKey()),
                List.of(new CreateExpenseRequest.PayerInput(payer.getId(), request.amount())),
                List.of(new CreateExpenseRequest.ParticipantInput(
                        owes.getId(), request.amount(), null, null,
                        // The borrower settles their own loan, whatever standing delegation they
                        // have. A delegation says "somebody else pays my share of the dinners",
                        // which is not a statement about money they personally borrowed.
                        owes.getId())));

        TallyExpenseEntity loan = expenseService.createEntity(
                userId, groupId, expenseRequest, TallyExpenseKind.LOAN, request.dueDate());

        log.debug("Recorded {} loan {} of {} between {} and {}",
                request.direction(), loan.getId(), loan.getTotalAmount(), payer.getId(), owes.getId());

        return view(loan, group, lent, them, BigDecimal.ZERO);
    }

    /* ============================== read ============================== */

    /**
     * Every loan the caller is party to, across all their ledgers.
     *
     * <p>Outstanding first, then by due date, because the list exists to answer "what is still
     * out there" -- a settled loan is history and a dated one is a commitment, so the two sort
     * differently on purpose.
     */
    @Transactional(readOnly = true)
    public List<TallyLoanDto> listMine(Long userId) {
        Map<String, TallyGroupMemberEntity> myRowByGroup = members
                .findByUserIdAndStatus(userId, TallyMemberStatus.ACTIVE).stream()
                .collect(Collectors.toMap(TallyGroupMemberEntity::getGroupId, Function.identity()));
        if (myRowByGroup.isEmpty()) return List.of();
        return loansIn(myRowByGroup.keySet(), myRowByGroup);
    }

    /** The loans in one ledger. Same shape, so a ledger's tab and the hub agree. */
    @Transactional(readOnly = true)
    public List<TallyLoanDto> listForGroup(Long userId, String groupId) {
        access.requireVisibleGroup(userId, groupId);
        TallyGroupMemberEntity me = access.requireMembership(userId, groupId);
        return loansIn(List.of(groupId), Map.of(groupId, me));
    }

    /* ============================== internals ============================== */

    private List<TallyLoanDto> loansIn(Collection<String> groupIds,
                                       Map<String, TallyGroupMemberEntity> myRowByGroup) {
        List<TallyExpenseEntity> loans = expenses.findLoans(groupIds);
        if (loans.isEmpty()) return List.of();

        List<String> loanIds = loans.stream().map(TallyExpenseEntity::getId).toList();

        // Three batched reads rather than three per loan: who paid (which gives the direction),
        // how much has come back, and the names.
        // A loan has exactly one payer and one beneficiary by construction. Where a correction
        // has left more, the first is a better answer than a crash.
        Map<String, String> payerByLoan = payers.findByExpenseIdIn(loanIds).stream()
                .collect(Collectors.toMap(TallyExpensePayerEntity::getExpenseId,
                        TallyExpensePayerEntity::getMemberId, (a, b) -> a));
        Map<String, String> owesByLoan = shares.findByExpenseIdIn(loanIds).stream()
                .collect(Collectors.toMap(TallyExpenseShareEntity::getExpenseId,
                        TallyExpenseShareEntity::getBeneficiaryMemberId, (a, b) -> a));
        Map<String, BigDecimal> repaidByLoan = settlements.sumRepaidByLoan(loanIds).stream()
                .filter(t -> t.getMemberId() != null)
                .collect(Collectors.toMap(MemberTotal::getMemberId, MemberTotal::getTotal));
        Map<String, TallyGroupMemberEntity> roster = members.findByGroupIdIn(groupIds).stream()
                .collect(Collectors.toMap(TallyGroupMemberEntity::getId, Function.identity()));
        Map<String, TallyGroupEntity> groupById = groups.findByIdIn(groupIds).stream()
                .collect(Collectors.toMap(TallyGroupEntity::getId, Function.identity()));

        return loans.stream()
                .map(loan -> {
                    TallyGroupMemberEntity me = myRowByGroup.get(loan.getGroupId());
                    if (me == null) return null;   // not the caller's ledger; skip rather than leak
                    String payerId = payerByLoan.get(loan.getId());
                    String owesId = owesByLoan.get(loan.getId());
                    boolean lent = me.getId().equals(payerId);
                    // The other side is whichever of the two the caller is not.
                    TallyGroupMemberEntity them = roster.get(lent ? owesId : payerId);
                    if (them == null) return null;
                    return view(loan, groupById.get(loan.getGroupId()), lent, them,
                            repaidByLoan.getOrDefault(loan.getId(), BigDecimal.ZERO));
                })
                .filter(Objects::nonNull)
                // Outstanding before settled, then soonest due, then newest.
                .sorted(Comparator.comparing((TallyLoanDto d) -> d.settled())
                        .thenComparing(d -> d.dueDate() == null ? LocalDate.MAX : d.dueDate())
                        .thenComparing(TallyLoanDto::loanDate, Comparator.reverseOrder()))
                .toList();
    }

    private TallyLoanDto view(TallyExpenseEntity loan, TallyGroupEntity group, boolean lent,
                              TallyGroupMemberEntity them, BigDecimal repaid) {
        BigDecimal principal = loan.getTotalAmount();
        BigDecimal safeRepaid = repaid == null ? BigDecimal.ZERO : repaid;
        // Floored at zero: somebody rounding 490 up to 500 when paying back should read as
        // settled, not as a debt running the other way.
        BigDecimal outstanding = principal.subtract(safeRepaid).max(BigDecimal.ZERO);
        boolean settled = outstanding.signum() == 0;

        LocalDate today = LocalDate.now(clock.withZone(IST));
        boolean overdue = !settled && loan.getDueDate() != null && loan.getDueDate().isBefore(today);

        return new TallyLoanDto(
                loan.getId(),
                loan.getGroupId(),
                group == null ? null : group.getName(),
                them.getDisplayName(),
                them.getId(),
                lent ? TallyLoanDirection.LENT : TallyLoanDirection.BORROWED,
                principal,
                safeRepaid,
                outstanding,
                loan.getExpenseDate(),
                loan.getDueDate(),
                overdue,
                settled,
                loan.getNotes());
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }
}
