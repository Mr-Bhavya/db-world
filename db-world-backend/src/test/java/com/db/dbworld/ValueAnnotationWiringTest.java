package com.db.dbworld;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.type.filter.AnnotationTypeFilter;
import org.springframework.stereotype.Component;
import org.springframework.stereotype.Controller;
import org.springframework.stereotype.Repository;
import org.springframework.stereotype.Service;
import org.springframework.web.bind.annotation.RestController;

import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.Parameter;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * {@code @Value} must never be used to inject a collection.
 *
 * <p><b>The bug.</b> {@code SecurityConfig} read the CORS allow-list with
 * {@code @Value("${app.cors.allowed-origin-patterns}")} into a {@code List<String>}, against a
 * YAML sequence. That cannot work, and it does not fail quietly: a YAML list is flattened into
 * INDEXED properties — {@code app.cors.allowed-origin-patterns[0]}, {@code [1]}, … — so no
 * property with the bare list name exists at all, and the context dies at startup with
 * "Could not resolve placeholder". {@code @Value} can only produce a List by splitting a
 * comma-separated STRING. Reading a sequence is what {@code @ConfigurationProperties} binding is
 * for; see {@code CorsProperties}.
 *
 * <p><b>Why nothing caught it.</b> This project has no {@code @SpringBootTest} by design — the
 * app needs MySQL, aria2 and FCM to stand up — so 984 green tests said nothing about whether the
 * context could actually boot. The failure only appeared on the next real start. Same reasoning
 * and same technique as {@link JacksonBeanWiringTest}: plain reflection over the scanned
 * components, no context and no infrastructure, failing on the next class to repeat the mistake
 * rather than on the next deploy.
 *
 * <p>Checks fields, constructor parameters and {@code @Bean}-method parameters, because
 * {@code @Value} is legal in all three and wrong in all three.
 */
class ValueAnnotationWiringTest {

    private static final String ROOT_PACKAGE = "com.db.dbworld";

    @Test
    void noComponentInjectsACollectionThroughValue() {
        List<String> offenders = new ArrayList<>();

        for (Class<?> bean : scanComponents()) {
            for (Field field : bean.getDeclaredFields()) {
                if (field.isAnnotationPresent(Value.class) && isCollection(field.getType())) {
                    offenders.add(describe(bean, field.getName(), field.getType(),
                            field.getAnnotation(Value.class)));
                }
            }
            for (Constructor<?> constructor : bean.getDeclaredConstructors()) {
                collectFrom(bean, constructor.getParameters(), offenders);
            }
            for (var method : bean.getDeclaredMethods()) {
                collectFrom(bean, method.getParameters(), offenders);
            }
        }

        assertThat(offenders)
                .withFailMessage("""
                        @Value cannot read a YAML list — a sequence becomes indexed properties \
                        (name[0], name[1], ...), so the bare placeholder resolves to nothing and \
                        the context fails at startup. Use @ConfigurationProperties instead \
                        (see CorsProperties), or make the property a comma-separated string.%n  %s""",
                        String.join("%n  ".formatted(), offenders))
                .isEmpty();
    }

    private static void collectFrom(Class<?> bean, Parameter[] parameters, List<String> offenders) {
        for (Parameter parameter : parameters) {
            if (parameter.isAnnotationPresent(Value.class) && isCollection(parameter.getType())) {
                offenders.add(describe(bean, parameter.getName(), parameter.getType(),
                        parameter.getAnnotation(Value.class)));
            }
        }
    }

    /** Arrays are fine — {@code @Value} splits a comma-separated string into one. */
    private static boolean isCollection(Class<?> type) {
        return Collection.class.isAssignableFrom(type) || Map.class.isAssignableFrom(type);
    }

    private static String describe(Class<?> bean, String name, Class<?> type, Value value) {
        return "%s.%s is a %s injected with @Value(\"%s\")"
                .formatted(bean.getSimpleName(), name, type.getSimpleName(), value.value());
    }

    /** Every Spring-managed component under the app, without booting a context. */
    private static List<Class<?>> scanComponents() {
        var scanner = new ClassPathScanningCandidateComponentProvider(false);
        scanner.addIncludeFilter(new AnnotationTypeFilter(Service.class));
        scanner.addIncludeFilter(new AnnotationTypeFilter(Component.class));
        scanner.addIncludeFilter(new AnnotationTypeFilter(Repository.class));
        scanner.addIncludeFilter(new AnnotationTypeFilter(Controller.class));
        scanner.addIncludeFilter(new AnnotationTypeFilter(RestController.class));
        scanner.addIncludeFilter(new AnnotationTypeFilter(
                org.springframework.context.annotation.Configuration.class));

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
