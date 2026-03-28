package com.db.dbworld.app.cinema.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;

import java.lang.annotation.*;

@Target({ElementType.FIELD, ElementType.PARAMETER})
@Retention(RetentionPolicy.RUNTIME)
@Documented
@Constraint(validatedBy = RecordTypeValidator.class)
public @interface ValidRecordType {

    String message() default "Unsupported record type";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}