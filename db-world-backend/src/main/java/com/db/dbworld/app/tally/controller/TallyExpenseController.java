package com.db.dbworld.app.tally.controller;

import com.db.dbworld.app.tally.dto.CreateExpenseRequest;
import com.db.dbworld.app.tally.dto.TallyExpenseDto;
import com.db.dbworld.app.tally.dto.TallyExpensePageDto;
import com.db.dbworld.app.tally.service.TallyExpenseService;
import com.db.dbworld.core.context.UserContext;
import com.db.dbworld.core.role.annotations.AnyRole;
import com.db.dbworld.payloads.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

/**
 * Expenses: the money going out, and the corrections to it.
 *
 * <p>Two base paths, on purpose. Creating and listing are scoped to a group, because that is the
 * thing you are looking at. Acting on one expense is not: an expense id is a UUID that already
 * identifies exactly one row in one group, and repeating the group in the path would add a
 * second source of truth about which group it belongs to — and therefore a way for the two to
 * disagree.
 */
@RestController
@RequiredArgsConstructor
@AnyRole
public class TallyExpenseController {

    private final TallyExpenseService expenses;
    private final UserContext userContext;

    /**
     * A page of the group's expense feed, newest first.
     *
     * <p>Paged on the cursor the previous page returned, not on an offset. Pass
     * {@code cursorDate} and {@code cursorId} together — either alone is treated as no cursor,
     * since half a keyset cursor cannot address a position.
     */
    @GetMapping("/api/tally/groups/{groupId}/expenses")
    public ResponseEntity<ApiResponse<TallyExpensePageDto>> list(
            @PathVariable String groupId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate cursorDate,
            @RequestParam(required = false) String cursorId,
            @RequestParam(required = false) Integer size) {
        return TallyResponses.ok(expenses.list(userContext.userId(), groupId, cursorDate, cursorId, size));
    }

    /**
     * Records an expense and posts it to the ledger.
     *
     * <p>Send an {@code idempotencyKey}. Without one, a request that times out after the server
     * committed is indistinguishable from one that never arrived, and retrying books the expense
     * twice.
     */
    @PostMapping("/api/tally/groups/{groupId}/expenses")
    public ResponseEntity<ApiResponse<TallyExpenseDto>> create(
            @PathVariable String groupId,
            @Valid @RequestBody CreateExpenseRequest request) {
        var expense = expenses.create(userContext.userId(), groupId, request);
        return TallyResponses.created("Expense added", expense);
    }

    @GetMapping("/api/tally/expenses/{expenseId}")
    public ResponseEntity<ApiResponse<TallyExpenseDto>> get(@PathVariable String expenseId) {
        return TallyResponses.ok(expenses.get(userContext.userId(), expenseId));
    }

    /**
     * Corrects an expense by voiding it and posting a replacement.
     *
     * <p>PUT rather than PATCH, and it returns a <b>new</b> expense with a new id. The original
     * is kept and marked voided: the ledger is append-only and already holds entries describing
     * an allocation of the old total, so editing the row underneath them would leave the two
     * describing different facts with no record that anything changed.
     */
    @PutMapping("/api/tally/expenses/{expenseId}")
    public ResponseEntity<ApiResponse<TallyExpenseDto>> replace(
            @PathVariable String expenseId,
            @Valid @RequestBody CreateExpenseRequest request) {
        var expense = expenses.replace(userContext.userId(), expenseId, request);
        return TallyResponses.ok("Expense corrected", expense);
    }

    /**
     * Puts a removed expense back.
     *
     * <p>201, because it creates one: the removed expense stays removed and this is a fresh
     * copy of its contents. Voiding wrote a reversal into an append-only ledger, and there is
     * no un-reversing that — so "restore" means re-post, and the history keeps both, which is
     * the point of having a log.
     */
    @PostMapping("/api/tally/expenses/{expenseId}/restore")
    public ResponseEntity<ApiResponse<TallyExpenseDto>> restore(@PathVariable String expenseId) {
        var expense = expenses.restore(userContext.userId(), expenseId);
        return TallyResponses.created("Put %s back".formatted(expense.description()), expense);
    }

    /**
     * Voids an expense and reverses its ledger entries.
     *
     * <p>Nothing is deleted, so this returns the voided expense rather than an empty body — the
     * shares and payers are still there to read, and it is the reversal that moves the money
     * back, not the disappearance of a row.
     */
    @DeleteMapping("/api/tally/expenses/{expenseId}")
    public ResponseEntity<ApiResponse<TallyExpenseDto>> voidExpense(@PathVariable String expenseId) {
        var expense = expenses.voidExpense(userContext.userId(), expenseId);
        return TallyResponses.ok("Expense voided", expense);
    }
}
