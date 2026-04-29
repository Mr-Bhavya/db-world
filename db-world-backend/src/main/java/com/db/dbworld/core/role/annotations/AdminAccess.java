package com.db.dbworld.core.role.annotations;

import com.db.dbworld.config.AppConstants;
import org.springframework.security.access.prepost.PreAuthorize;

import java.lang.annotation.*;

/**
 * Restricts access to OWNER or ADMIN roles.
 * Use for privileged operations (e.g. managing records, users, settings).
 */
@Target({ElementType.METHOD, ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
@Documented
@PreAuthorize(AppConstants.OWNER_ADMIN_AUTHORIZE)
public @interface AdminAccess {
}
