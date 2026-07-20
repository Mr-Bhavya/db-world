package com.db.dbworld.app.cinema.rail.service;

import com.db.dbworld.app.cinema.rail.rule.RailRule;
import tools.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class RailRuleParser {

    private final ObjectMapper mapper;

    public RailRule parse(String json) {

        try {
            return mapper.readValue(json, RailRule.class);
        }
        catch (Exception e) {
            throw new RuntimeException("Invalid rail rule: " + json, e);
        }
    }
}