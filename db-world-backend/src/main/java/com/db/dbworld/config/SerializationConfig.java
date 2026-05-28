package com.db.dbworld.config;

import com.db.dbworld.payloads.dbcinema.stream.PathAdapter;
import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.core.StreamReadConstraints;
import com.fasterxml.jackson.core.StreamWriteConstraints;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonSerializer;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.SerializerProvider;
import com.fasterxml.jackson.databind.module.SimpleModule;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonPrimitive;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OneToOne;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.data.domain.Page;

import java.io.IOException;
import java.nio.file.Path;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Jackson 2 + Gson configuration.
 *
 * <p><b>Spring Boot 4 migration note:</b> SB4 switched its HTTP layer to Jackson 3
 * ({@code tools.jackson.*} namespace) and removed {@code Jackson2ObjectMapperBuilderCustomizer}.
 * We still ship Jackson 2 (transitive) and use it directly for: WebSocket payloads,
 * Aria2 RPC, ffprobe parsing, log parsing, and anywhere code injects ObjectMapper.
 * HTTP request/response serialization now uses SB4's default Jackson 3 mapper — that
 * configuration is intentionally untouched in this migration pass; we'll port the
 * customisations (date format, stream constraints, page wrapper) to the Jackson 3
 * builder in a follow-up session along with the rest of the Jackson 2 → 3 sweep.
 */
@Configuration
public class SerializationConfig {

    /**
     * Application-wide Jackson 2 mapper. Marked {@code @Primary} so the 30+ direct
     * injections of {@code ObjectMapper} keep getting the configured Jackson 2
     * instance, not whatever proxy SB4's Jackson 3 auto-config might expose.
     */
    @Bean
    @Primary
    @SuppressWarnings({"rawtypes", "unchecked"})
    ObjectMapper objectMapper() {
        // Jackson 2.15+ default nesting depth (1000) trips on TV-series payloads
        // (seasons × episodes × providers). Relax globally so every factory shares.
        StreamReadConstraints.overrideDefaultStreamReadConstraints(
                StreamReadConstraints.builder()
                        .maxNestingDepth(Integer.MAX_VALUE)
                        .maxStringLength(Integer.MAX_VALUE)
                        .build());
        StreamWriteConstraints.overrideDefaultStreamWriteConstraints(
                StreamWriteConstraints.builder()
                        .maxNestingDepth(Integer.MAX_VALUE)
                        .build());

        SimpleModule extras = new SimpleModule();
        extras.addSerializer(Page.class, new PageJacksonSerializer());
        extras.addSerializer(Path.class, new PathJacksonSerializer());

        ObjectMapper mapper = new ObjectMapper();
        mapper.registerModule(new JavaTimeModule());
        mapper.registerModule(extras);
        mapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        mapper.disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);
        mapper.disable(SerializationFeature.FAIL_ON_EMPTY_BEANS);
        return mapper;
    }

    @SuppressWarnings("rawtypes")
    static class PageJacksonSerializer extends JsonSerializer<Page> {
        @Override
        public void serialize(Page page, JsonGenerator gen, SerializerProvider p) throws IOException {
            gen.writeStartObject();
            p.defaultSerializeField("content",         page.getContent(),          gen);
            gen.writeNumberField("totalElements",       page.getTotalElements());
            gen.writeNumberField("totalPages",          page.getTotalPages());
            gen.writeNumberField("number",              page.getNumber());
            gen.writeNumberField("size",                page.getSize());
            gen.writeNumberField("numberOfElements",    page.getNumberOfElements());
            gen.writeBooleanField("first",              page.isFirst());
            gen.writeBooleanField("last",               page.isLast());
            gen.writeBooleanField("empty",              page.isEmpty());
            gen.writeEndObject();
        }
    }

    static class PathJacksonSerializer extends JsonSerializer<Path> {
        @Override
        public void serialize(Path path, JsonGenerator gen, SerializerProvider p) throws IOException {
            gen.writeString(path.toString());
        }
    }

    // ── Gson (internal use: log parsers, utilities) ───────────────────────────

    @Bean
    Gson gson() {
        return new GsonBuilder()
                .addSerializationExclusionStrategy(new GsonJpaLazySkipStrategy())
                .registerTypeAdapter(Path.class, new PathAdapter())
                .registerTypeAdapter(Instant.class,
                        (com.google.gson.JsonSerializer<Instant>) (src, t, ctx) -> new JsonPrimitive(src.toString()))
                .registerTypeAdapter(LocalDateTime.class,
                        (com.google.gson.JsonSerializer<LocalDateTime>) (src, t, ctx) -> new JsonPrimitive(src.toString()))
                .registerTypeAdapter(LocalDate.class,
                        (com.google.gson.JsonSerializer<LocalDate>) (src, t, ctx) -> new JsonPrimitive(src.toString()))
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
