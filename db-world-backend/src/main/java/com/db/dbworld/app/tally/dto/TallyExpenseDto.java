package com.db.dbworld.app.tally.dto;

import com.db.dbworld.app.tally.entity.TallyExpenseStatus;
import com.db.dbworld.app.tally.entity.TallyMethod;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/** One expense with the payers and shares it was built from. */
public record TallyExpenseDto(
        String id,
        String groupId,
        String description,
        BigDecimal totalAmount,
        TallyMethod divisionMethod,
        String category,
        LocalDate expenseDate,
        String notes,
        TallyExpenseStatus status,
        Long createdByUserId,
        Instant createdAt,
        List<TallyExpensePayerDto> payers,
        List<TallyExpenseShareDto> shares
) {}
