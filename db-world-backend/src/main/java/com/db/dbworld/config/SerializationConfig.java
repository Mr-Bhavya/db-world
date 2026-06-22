package com.db.dbworld.config;

import com.db.dbworld.payloads.dbcinema.stream.PathAdapter;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonPrimitive;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OneToOne;
import org.springframework.boot.jackson.autoconfigure.JsonMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.domain.Page;
import tools.jackson.core.JsonGenerator;
import tools.jackson.core.StreamReadConstraints;
import tools.jackson.core.StreamWriteConstraints;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.SerializationContext;
import tools.jackson.databind.SerializationFeature;
import tools.jackson.databind.ValueSerializer;
import tools.jackson.databind.module.SimpleModule;

import java.nio.file.Path;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Jackson 3 + Gson configuration.
 *
 * <p>Jackson 3 made {@code ObjectMapper} immutable, so we can no longer mutate
 * Spring Boot's auto-configured mapper after the fact. Instead, we expose a
 * {@link JsonMapperBuilderCustomizer} that Spring Boot applies to its own
 * {@code JsonMapper.Builder} during auto-configuration — this keeps a single
 * {@code ObjectMapper} bean in the context (avoiding NoUniqueBean conflicts)
 * while still letting us register custom serializers and tweaks.
 *
 * <p>Notable Jackson 3 differences from Jackson 2:
 * <ul>
 *   <li>{@code ObjectMapper} is immutable — config goes through the builder.</li>
 *   <li>{@code JsonSerializer<T>} → {@link ValueSerializer}.</li>
 *   <li>{@code SerializerProvider} → {@link SerializationContext}.</li>
 *   <li>JSR-310 (java.time) types supported natively — no {@code JavaTimeModule}.</li>
 *   <li>{@code WRITE_DATES_AS_TIMESTAMPS} removed (ISO strings are default).</li>
 *   <li>{@code JsonProcessingException} → {@code JacksonException}.</li>
 * </ul>
 */
@Configuration
public class SerializationConfig {

    /**
     * Customizes Spring Boot 4's auto-configured Jackson 3 {@code JsonMapper}.
     * Spring Boot picks this up at startup; no separate {@code ObjectMapper}
     * bean is exposed, so there's a single mapper in the context.
     */
    @Bean
    JsonMapperBuilderCustomizer dbWorldJacksonCustomizer() {
        return builder -> {
            // Jackson defaults a 1000-deep nesting limit; TV-series payloads
            // (seasons × episodes × providers) easily blow past that. Relax
            // globally before any reader/writer factory is built.
            StreamReadConstraints.overrideDefaultStreamReadConstraints(
                    StreamReadConstraints.builder()
                            .maxNestingDepth(Integer.MAX_VALUE)
                            .maxStringLength(Integer.MAX_VALUE)
                            .build());
            StreamWriteConstraints.overrideDefaultStreamWriteConstraints(
                    StreamWriteConstraints.builder()
                            .maxNestingDepth(Integer.MAX_VALUE)
                            .build());

            SimpleModule extras = new SimpleModule()
                    .addSerializer(Page.class, new PageJacksonSerializer())
                    .addSerializer(Path.class, new PathJacksonSerializer());

            builder.addModule(extras)
                    .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
                    .disable(DeserializationFeature.FAIL_ON_NULL_FOR_PRIMITIVES)
                    .disable(SerializationFeature.FAIL_ON_EMPTY_BEANS);
        };
    }

    /**
     * Custom serializer for Spring Data {@link Page} — flattens to
     * {@code {content, totalElements, ...}} so frontend consumers don't have
     * to know about Page's internal shape.
     */
    @SuppressWarnings("rawtypes")
    static class PageJacksonSerializer extends ValueSerializer<Page> {
        @Override
        public void serialize(Page page, JsonGenerator gen, SerializationContext ctx) {
            gen.writeStartObject();
            gen.writeName("content");
            ctx.writeValue(gen, page.getContent());
            gen.writeNumberProperty("totalElements",    page.getTotalElements());
            gen.writeNumberProperty("totalPages",       page.getTotalPages());
            gen.writeNumberProperty("number",           page.getNumber());
            gen.writeNumberProperty("size",             page.getSize());
            gen.writeNumberProperty("numberOfElements", page.getNumberOfElements());
            gen.writeBooleanProperty("first",           page.isFirst());
            gen.writeBooleanProperty("last",            page.isLast());
            gen.writeBooleanProperty("empty",           page.isEmpty());
            gen.writeEndObject();
        }
    }

    static class PathJacksonSerializer extends ValueSerializer<Path> {
        @Override
        public void serialize(Path path, JsonGenerator gen, SerializationContext ctx) {
            gen.writeString(path.toString());
        }
    }

    // ── Gson (log parsers + small utilities) — unchanged by Jackson 3 ─────────

    @Bean
    Gson gson() {
        return new GsonBuilder()
                .addSerializationExclusionStrategy(new GsonJpaLazySkipStrategy())
                .registerTypeAdapter(Path.class, new PathAdapter())
                .registerTypeAdapter(Instant.class,
                        (com.google.gson.JsonSerializer<Instant>) (src, t, c) -> new JsonPrimitive(src.toString()))
                .registerTypeAdapter(LocalDateTime.class,
                        (com.google.gson.JsonSerializer<LocalDateTime>) (src, t, c) -> new JsonPrimitive(src.toString()))
                .registerTypeAdapter(LocalDate.class,
                        (com.google.gson.JsonSerializer<LocalDate>) (src, t, c) -> new JsonPrimitive(src.toString()))
                .serializeNulls()
                .create();
    }

    static class GsonJpaLazySkipStrategy implements com.google.gson.ExclusionStrategy {
        @Override public boolean shouldSkipField(com.google.gson.FieldAttributes f) {
            return f.getAnnotation(ManyToOne.class)  != null ||
                   f.getAnnotation(OneToOne.class)   != null ||
                   f.getAnnotation(ManyToMany.class) != null ||
                   f.getAnnotation(OneToMany.class)  != null;
        }
        @Override public boolean shouldSkipClass(Class<?> c) { return false; }
    }
}
