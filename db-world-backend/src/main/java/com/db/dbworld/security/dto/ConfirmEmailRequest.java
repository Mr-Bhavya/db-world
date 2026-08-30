package com.db.dbworld.security.dto;

import jakarta.validation.constraints.NotBlank;

/** Redeems an emailed verification link. */
public record ConfirmEmailRequest(@NotBlank String token) {}
