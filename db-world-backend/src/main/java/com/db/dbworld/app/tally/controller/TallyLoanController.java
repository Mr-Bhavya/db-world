package com.db.dbworld.app.tally.controller;

import com.db.dbworld.api.response.ApiResponse;
import com.db.dbworld.app.tally.dto.CreateLoanRequest;
import com.db.dbworld.app.tally.dto.TallyLoanDirection;
import com.db.dbworld.app.tally.dto.TallyLoanDto;
import com.db.dbworld.app.tally.service.TallyLoanService;
import com.db.dbworld.core.context.UserContext;
import com.db.dbworld.core.role.annotations.AnyRole;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Money lent and borrowed.
 *
 * <p>There is no repayment endpoint here, and that absence is the design. A repayment is a payment
 * between two people, which is exactly what a settlement already is — so it goes to
 * {@code POST /api/tally/groups/{groupId}/settlements} with {@code settlesExpenseId} naming the
 * loan. A second write path for "the same thing, but against a loan" would have been a second
 * place for the balance to be moved, and a second one to get wrong.
 */
@RestController
@RequiredArgsConstructor
@AnyRole
public class TallyLoanController {

    private final TallyLoanService loans;
    private final UserContext userContext;

    /**
     * Every loan the caller is party to, across all their ledgers.
     *
     * <p>Not scoped to a group, because the question it answers is not about one: "who owes me
     * money" is asked across everybody at once, and asking it per ledger is how you forget the
     * one you have not opened in three months.
     */
    @GetMapping("/api/tally/loans")
    public ResponseEntity<ApiResponse<List<TallyLoanDto>>> listMine() {
        return TallyResponses.ok(loans.listMine(userContext.userId()));
    }

    /** The loans in one ledger, for its own tab. */
    @GetMapping("/api/tally/groups/{groupId}/loans")
    public ResponseEntity<ApiResponse<List<TallyLoanDto>>> listForGroup(@PathVariable String groupId) {
        return TallyResponses.ok(loans.listForGroup(userContext.userId(), groupId));
    }

    /**
     * Records money lent or borrowed.
     *
     * <p>Send an {@code idempotencyKey}, for the same reason an expense wants one: a request that
     * times out after the server committed is indistinguishable from one that never arrived, and
     * retrying it would record the loan twice.
     */
    @PostMapping("/api/tally/groups/{groupId}/loans")
    public ResponseEntity<ApiResponse<TallyLoanDto>> create(
            @PathVariable String groupId,
            @Valid @RequestBody CreateLoanRequest request) {
        var loan = loans.create(userContext.userId(), groupId, request);
        return TallyResponses.created(
                loan.direction() == TallyLoanDirection.LENT ? "Loan recorded" : "Borrowing recorded",
                loan);
    }
}
