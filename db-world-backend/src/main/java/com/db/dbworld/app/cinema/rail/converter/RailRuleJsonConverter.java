package com.db.dbworld.app.cinema.rail.converter;

import com.db.dbworld.cinema.rail.rule.RailRule;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = false)
public class RailRuleJsonConverter implements AttributeConverter<RailRule, String> {

    private static final ObjectMapper mapper = new ObjectMapper();

    @Override
    public String convertToDatabaseColumn(RailRule rule) {

        try {
            return mapper.writeValueAsString(rule);
        }
        catch (Exception e) {
            throw new RuntimeException("Failed to serialize RailRule", e);
        }
    }

    @Override
    public RailRule convertToEntityAttribute(String json) {

        try {
            return mapper.readValue(json, RailRule.class);
        }
        catch (Exception e) {
            throw new RuntimeException("Failed to deserialize RailRule", e);
        }
    }
}