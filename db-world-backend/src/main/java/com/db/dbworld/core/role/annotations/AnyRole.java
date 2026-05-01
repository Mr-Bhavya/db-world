package com.db.dbworld.core.role.annotations;

import com.db.dbworld.config.AppConstants;
import org.springframework.security.access.prepost.PreAuthorize;

import java.lang.annotation.*;

/**
 * Allows access to any authenticated role (OWNER, ADMIN, VIEWER).
 * Use for standard user-facing operations (e.g. browsing content, viewing profile).
 */
@Target({ElementType.METHOD, ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
@Documented
@PreAuthorize(AppConstants.ALL_AUTHORIZE)
public @interface AnyRole {
}
