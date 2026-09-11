package com.db.dbworld.app.ipo;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.type.filter.AnnotationTypeFilter;
import org.springframework.stereotype.Component;
import org.springframework.stereotype.Service;

import java.lang.reflect.Constructor;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Structural guard on the IPO package's bean wiring.
 *
 * <p>Exists because of a real boot failure: {@code InvestorgainLiveService} was written with the
 * package's usual pair of constructors — the public one Spring injects plus a package-private one
 * taking a fixed {@link java.time.Clock} for deterministic tests — but without {@code @Autowired} on
 * either. Spring then has no way to choose, falls back to looking for a no-arg constructor, and the
 * whole context dies at startup with {@code No default constructor found}.
 *
 * <p>Nothing caught it: there is no {@code @SpringBootTest} in this project (the app needs MySQL,
 * aria2 and FCM to stand up, so a full context test would be more trouble than it's worth), and unit
 * tests call the test constructor directly, so the ambiguity is invisible to them. This closes that
 * gap with plain reflection over the scanned components — no context, no infrastructure, and it
 * fails on the next class that repeats the mistake rather than on the next deploy.
 */
class IpoBeanWiringTest {

    private static final String IPO_PACKAGE = "com.db.dbworld.app.ipo";

    @Test
    void everyMultiConstructorBeanMarksExactlyOneForInjection() {
        List<String> offenders = new ArrayList<>();
        for (Class<?> bean : scanIpoComponents()) {
            Constructor<?>[] constructors = bean.getDeclaredConstructors();
            if (constructors.length < 2) {
                continue; // a single constructor needs no annotation — Spring just uses it
            }
            long annotated = List.of(constructors).stream()
                    .filter(c -> c.isAnnotationPresent(Autowired.class))
                    .count();
            if (annotated != 1) {
                offenders.add("%s has %d constructors but %d annotated @Autowired"
                        .formatted(bean.getSimpleName(), constructors.length, annotated));
            }
        }
        assertThat(offenders)
                .withFailMessage("Spring cannot pick a constructor for these beans and the context "
                        + "will fail to start:%n  %s", String.join("%n  ".formatted(), offenders))
                .isEmpty();
    }

    /** Every {@code @Service}/{@code @Component} under the IPO package, without booting a context. */
    private static List<Class<?>> scanIpoComponents() {
        ClassPathScanningCandidateComponentProvider scanner =
                new ClassPathScanningCandidateComponentProvider(false);
        scanner.addIncludeFilter(new AnnotationTypeFilter(Service.class));
        scanner.addIncludeFilter(new AnnotationTypeFilter(Component.class));

        List<Class<?>> beans = new ArrayList<>();
        scanner.findCandidateComponents(IPO_PACKAGE).forEach(definition -> {
            try {
                beans.add(Class.forName(definition.getBeanClassName()));
            } catch (ClassNotFoundException e) {
                throw new IllegalStateException("Scanned bean is not loadable: " + definition, e);
            }
        });
        // A scan that silently found nothing would make this test vacuously green.
        assertThat(beans).as("scanned IPO components").isNotEmpty();
        return beans;
    }
}
