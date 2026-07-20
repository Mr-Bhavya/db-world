package com.db.dbworld.app.wallet.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

public record CreateShareRequest(@Min(1) @Max(720) int expiresInHours, Integer maxAccessCount) {}
