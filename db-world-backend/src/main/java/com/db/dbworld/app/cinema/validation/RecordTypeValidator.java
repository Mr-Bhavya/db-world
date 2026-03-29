package com.db.dbworld.app.cinema.validation;

import com.db.dbworld.app.cinema.enums.RecordType;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

import java.util.EnumSet;

public class RecordTypeValidator
        implements ConstraintValidator<ValidRecordType, RecordType> {

    private static final EnumSet<RecordType> SUPPORTED =
            EnumSet.of(RecordType.MOVIE, RecordType.TV_SERIES);

    @Override
    public boolean isValid(RecordType value, ConstraintValidatorContext context) {

        if (value == null) {
            return true; // let @NotNull handle null check
        }

        return SUPPORTED.contains(value);
    }
}