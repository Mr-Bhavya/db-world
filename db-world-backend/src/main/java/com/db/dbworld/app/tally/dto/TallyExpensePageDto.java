package com.db.dbworld.app.tally.dto;

import java.time.LocalDate;
import java.util.List;

/**
 * One page of a group's expense feed, newest first.
 *
 * <p>The cursor is the last row's {@code (expenseDate, id)} handed back verbatim, because the
 * feed is keyset-paginated rather than offset-paginated. {@code expense_date} is a DATE, so a
 * group with several expenses on one day has no total order under OFFSET alone: inserting a row
 * shifts the window and the reader both sees a duplicate and skips a different row. Paging on
 * the full tuple is stable no matter what is written between requests.
 *
 * <p>Both cursor fields are null on the last page, which is also what {@code hasMore} says.
 */
public record TallyExpensePageDto(
        List<TallyExpenseDto> items,
        LocalDate nextCursorDate,
        String nextCursorId,
        boolean hasMore
) {}
