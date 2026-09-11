package com.db.dbworld;

import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.type.filter.AnnotationTypeFilter;
import org.springframework.stereotype.Component;
import org.springframework.stereotype.Controller;
import org.springframework.stereotype.Repository;
import org.springframework.stereotype.Service;
import org.springframework.web.bind.annotation.RestController;

import java.lang.reflect.Constructor;
import java.lang.reflect.Parameter;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Structural guard: no bean may ask Spring to inject a Jackson 2 type.
 *
 * <p>Exists because of a real production boot failure on 2026-09-06.
 * {@code SiteContentService} took a {@code com.fasterxml.jackson.databind.ObjectMapper}
 * through its constructor, and the context died on startup:
 *
 * <pre>
 * APPLICATION FAILED TO START
 * Parameter 0 of constructor in com.db.dbworld.app.content.SiteContentService required
 * a bean of type 'com.fasterxml.jackson.databind.ObjectMapper' that could not be found.
 * </pre>
 *
 * <p><b>Why the wrong import compiles.</b> Spring Boot 4 ships Jackson 3, whose databind
 * moved to {@code tools.jackson}. Jackson 2 is still on the classpath transitively
 * (jackson-annotations, and libraries that depend on 2.x), so
 * {@code com.fasterxml.jackson.databind.ObjectMapper} resolves at compile time perfectly
 * well — it simply has no bean behind it, and nothing says so until Spring tries to wire
 * it. IDE auto-import picks the wrong one readily, because the two differ by package
 * alone.
 *
 * <p><b>Why nothing caught it.</b> Unit tests construct these classes directly and pass a
 * mapper in, so the ambiguity is invisible to them, and this project has no
 * {@code @SpringBootTest} by design — the app needs MySQL, aria2 and FCM to stand up, so
 * a full context test costs more than it returns. Same reasoning, and the same technique,
 * as {@code IpoBeanWiringTest}: plain reflection over the scanned components, no context
 * and no infrastructure, failing on the next class to repeat the mistake rather than on
 * the next deploy.
 *
 * <p>This does not forbid Jackson 2 outright — several services legitimately hold a
 * private {@code com.fasterxml} mapper of their own. It forbids asking the CONTAINER for
 * one, which is the part that cannot work.
 */
class JacksonBeanWiringTest {

    private static final String ROOT_PACKAGE = "com.db.dbworld";

    /** Jackson 2's databind package. Nothing in here is available as a bean. */
    private static final String JACKSON_2_DATABIND = "com.fasterxml.jackson.databind.";

    @Test
    void noBeanAsksForAJackson2TypeThroughItsConstructor() {
        List<String> offenders = new ArrayList<>();

        for (Class<?> bean : scanComponents()) {
            for (Constructor<?> constructor : bean.getDeclaredConstructors()) {
                for (Parameter parameter : constructor.getParameters()) {
                    String type = parameter.getType().getName();
                    if (type.startsWith(JACKSON_2_DATABIND)) {
                        offenders.add("%s takes %s — Spring Boot 4 has no such bean; use "
                                + "a private `new tools.jackson.databind.ObjectMapper()` instead"
                                .formatted(bean.getName(), type));
                    }
                }
            }
        }

        assertThat(offenders)
                .withFailMessage("These beans will fail the context at startup:%n  %s",
                        String.join("%n  ".formatted(), offenders))
                .isEmpty();
    }

    /** Every Spring-managed component under the app, without booting a context. */
    private static List<Class<?>> scanComponents() {
        var scanner = new ClassPathScanningCandidateComponentProvider(false);
        scanner.addIncludeFilter(new AnnotationTypeFilter(Service.class));
        scanner.addIncludeFilter(new AnnotationTypeFilter(Component.class));
        scanner.addIncludeFilter(new AnnotationTypeFilter(Repository.class));
        scanner.addIncludeFilter(new AnnotationTypeFilter(Controller.class));
        scanner.addIncludeFilter(new AnnotationTypeFilter(RestController.class));

        List<Class<?>> beans = new ArrayList<>();
        scanner.findCandidateComponents(ROOT_PACKAGE).forEach(definition -> {
            try {
                beans.add(Class.forName(definition.getBeanClassName()));
            } catch (ClassNotFoundException e) {
                throw new IllegalStateException("Scanned bean is not loadable: " + definition, e);
            }
        });

        // A scan that silently matched nothing would make this test pass forever.
        assertThat(beans).as("components scanned under %s", ROOT_PACKAGE).isNotEmpty();
        return beans;
    }
}
