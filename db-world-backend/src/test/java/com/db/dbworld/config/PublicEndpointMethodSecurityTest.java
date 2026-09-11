package com.db.dbworld.config;

import com.db.dbworld.app.cinema.catalog.controllers.CatalogController;
import com.db.dbworld.app.cinema.rail.controller.RailController;
import com.db.dbworld.app.cinema.tmdb.collection.controller.CollectionController;
import com.db.dbworld.app.cinema.tmdb.people.controller.PersonsController;
import com.db.dbworld.app.ipo.controller.IpoController;
import com.db.dbworld.core.role.annotations.AdminAccess;
import com.db.dbworld.core.role.annotations.AnyRole;
import com.db.dbworld.core.role.annotations.OwnerOnly;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.security.access.prepost.PreAuthorize;

import java.lang.annotation.Annotation;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Guards the trap that broke anonymous browsing once already.
 *
 * <p>Opening an endpoint to visitors takes TWO changes, and only one of them is
 * obvious. Listing the path in {@link AppConstants#PUBLIC_GET_APIS} gets the request
 * past the security filter chain — but {@code @PreAuthorize} (including the
 * {@code @AnyRole} / {@code @AdminAccess} / {@code @OwnerOnly} wrappers) is method
 * security, which runs afterwards and denies the call anyway.
 *
 * <p>The failure is nastier than it sounds: the resulting
 * {@code AuthorizationDeniedException} is thrown from inside the controller proxy, well
 * past the point where Spring Security would have turned it into a clean 401, so it
 * surfaced as a **500 with a stack trace**. Every catalog and IPO read did that for
 * signed-out visitors.
 *
 * <p>So: if a controller's endpoints are public, it must carry no role annotation.
 * Re-adding one to any class below breaks this test rather than the site.
 */
class PublicEndpointMethodSecurityTest {

    /** Controllers whose endpoints are listed in {@code PUBLIC_GET_APIS}. */
    private static final Class<?>[] PUBLIC_CONTROLLERS = {
            CatalogController.class,
            RailController.class,
            CollectionController.class,
            PersonsController.class,
            IpoController.class,
    };

    private static List<String> roleAnnotationsOn(Class<?> controller) {
        List<String> found = new ArrayList<>();

        for (Annotation a : controller.getAnnotations()) {
            if (isRoleAnnotation(a)) {
                found.add("class-level @" + a.annotationType().getSimpleName());
            }
        }

        for (Method m : controller.getDeclaredMethods()) {
            for (Annotation a : m.getAnnotations()) {
                if (isRoleAnnotation(a)) {
                    found.add(m.getName() + "() @" + a.annotationType().getSimpleName());
                }
            }
        }
        return found;
    }

    private static boolean isRoleAnnotation(Annotation a) {
        Class<? extends Annotation> t = a.annotationType();
        return t == AnyRole.class
                || t == AdminAccess.class
                || t == OwnerOnly.class
                || t == PreAuthorize.class;
    }

    @DisplayName("a controller behind PUBLIC_GET_APIS carries no method security")
    @ParameterizedTest(name = "{0}")
    @ValueSource(classes = {
            CatalogController.class,
            RailController.class,
            CollectionController.class,
            PersonsController.class,
            IpoController.class,
    })
    void publicControllersHaveNoRoleAnnotations(Class<?> controller) {
        assertThat(roleAnnotationsOn(controller))
                .as("""
                        %s serves endpoints listed in AppConstants.PUBLIC_GET_APIS, so a role \
                        annotation here denies anonymous visitors AFTER the filter chain has \
                        already let them through — which surfaces as a 500, not a 401. Either \
                        drop the annotation, or take the endpoint out of PUBLIC_GET_APIS.\
                        """.formatted(controller.getSimpleName()))
                .isEmpty();
    }

    /**
     * The sibling that must stay locked. {@code IpoApplicationController} shares the
     * {@code /api/ipo} base path with the public {@link IpoController}, so a careless
     * "make IPO public" sweep could strip its guard too — and it exposes a user's own
     * applications.
     */
    @org.junit.jupiter.api.Test
    void userScopedIpoEndpointsStayProtected() throws ClassNotFoundException {
        Class<?> applications = Class.forName(
                "com.db.dbworld.app.ipo.controller.IpoApplicationController");

        assertThat(roleAnnotationsOn(applications))
                .as("IpoApplicationController is user-scoped and must keep method security")
                .isNotEmpty();
    }

    /** Sanity check that the constant still lists what these tests assume. */
    @org.junit.jupiter.api.Test
    void publicGetApisCoversTheControllersUnderTest() {
        assertThat(AppConstants.PUBLIC_GET_APIS)
                .contains("/api/cinema/catalog/**")
                .contains("/api/ipo")
                .contains("/api/cinema/rails");
        assertThat(PUBLIC_CONTROLLERS).hasSize(5);
    }
}
