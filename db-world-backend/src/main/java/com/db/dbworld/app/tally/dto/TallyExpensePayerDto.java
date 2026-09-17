package com.db.dbworld.app.tally.dto;

import java.math.BigDecimal;

/** Money actually handed over for an expense, by one member. */
public record TallyExpensePayerDto(String memberId, BigDecimal amount) {}
