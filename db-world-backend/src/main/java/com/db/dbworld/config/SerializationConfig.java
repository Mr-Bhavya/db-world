package com.db.dbworld.config;

import com.db.dbworld.payloads.dbcinema.stream.PathAdapter;
import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.module.SimpleModule;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonPrimitive;
import jakarta.persistence.*;
import org.springframework.boot.autoconfigure.jackson.Jackson2ObjectMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.domain.Page;

import java.io.IOException;
import java.nio.file.Path;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Configuration
public class SerializationConfig {

    // ── Jackson (HTTP responses) ──────────────────────────────────────────────

    @Bean
    @SuppressWarnings({"rawtypes", "unchecked"})
    Jackson2ObjectMapperBuilderCustomizer jacksonCustomizer() {
        SimpleModule extras = new SimpleModule();
        extras.addSerializer(Page.class, new PageJacksonSerializer());
        extras.addSerializer(Path.class, new PathJacksonSerializer());

        return builder -> builder
                .modules(new JavaTimeModule(), extras)
                .featuresToDisable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
                .featuresToDisable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
                .featuresToDisable(SerializationFeature.FAIL_ON_EMPTY_BEANS);
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

    // ── Gson (internal use only: log parsers, JWT, utilities) ────────────────

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
