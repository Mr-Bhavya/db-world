package com.db.dbworld.core.role.annotations;

import com.db.dbworld.config.AppConstants;
import org.springframework.security.access.prepost.PreAuthorize;

import java.lang.annotation.*;

/**
 * Restricts access to OWNER role only.
 * Use for destructive or super-admin operations (e.g. deleting users, system config).
 */
@Target({ElementType.METHOD, ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
@Documented
@PreAuthorize(AppConstants.OWNER_AUTHORIZE)
public @interface OwnerOnly {
}
