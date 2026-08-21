package com.db.dbworld.app.cinema.catalog.tags.rule;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import lombok.extern.log4j.Log4j2;
import tools.jackson.databind.ObjectMapper;

/**
 * Persists {@link TagRule} as JSON on {@code tag_definitions.rule}, mirroring
 * {@code RailRuleJsonConverter}.
 *
 * <p>Unlike that one, a failed READ is tolerated: tag rules are edited by admins at runtime, and a
 * row whose JSON can't be parsed must not break the whole tag list (the definitions endpoint loads
 * every row at once). A null rule simply means "not rule-driven", which is the safe reading —
 * membership is then left alone rather than being recomputed from a rule nobody can interpret.
 * Writes still throw, so a bad rule is rejected at the point of saving.
 */
@Log4j2
@Converter(autoApply = false)
public class TagRuleJsonConverter implements AttributeConverter<TagRule, String> {

    private static final ObjectMapper mapper = new ObjectMapper();

    @Override
    public String convertToDatabaseColumn(TagRule rule) {
        if (rule == null) return null;
        try {
            return mapper.writeValueAsString(rule);
        } catch (Exception e) {
            throw new IllegalArgumentException("Failed to serialize TagRule", e);
        }
    }

    @Override
    public TagRule convertToEntityAttribute(String json) {
        if (json == null || json.isBlank()) return null;
        try {
            return mapper.readValue(json, TagRule.class);
        } catch (Exception e) {
            log.error("Unreadable TagRule JSON — treating tag as manual. json={}", json, e);
            return null;
        }
    }
}
