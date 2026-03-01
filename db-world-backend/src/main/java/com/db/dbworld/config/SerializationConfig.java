package com.db.dbworld.config;

import com.db.dbworld.payloads.dbcinema.stream.PathAdapter;
import com.google.gson.*;
import jakarta.persistence.*;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.converter.json.GsonHttpMessageConverter;

import java.nio.file.Path;
import java.time.LocalDateTime;

@Configuration
public class SerializationConfig {

    @Bean
    Gson gson() {
        return new GsonBuilder()
                .addSerializationExclusionStrategy(new JpaLazySkipStrategy())
                .registerTypeAdapter(Path.class, new PathAdapter())
                .registerTypeAdapter(LocalDateTime.class,
                        (JsonSerializer<LocalDateTime>) (src, t, ctx) -> new JsonPrimitive(src.toString()))
                .serializeNulls()
                .create();
    }

    @Bean
    GsonHttpMessageConverter gsonHttpMessageConverter(Gson gson) {
        GsonHttpMessageConverter c = new GsonHttpMessageConverter();
        c.setGson(gson);
        return c;
    }

    static class JpaLazySkipStrategy implements ExclusionStrategy {
        @Override public boolean shouldSkipField(FieldAttributes f) {
            return f.getAnnotation(ManyToOne.class) != null ||
                    f.getAnnotation(OneToOne.class) != null ||
                    f.getAnnotation(ManyToMany.class) != null ||
                    f.getAnnotation(OneToMany.class) != null;
        }
        @Override public boolean shouldSkipClass(Class<?> c) { return false; }
    }
}

