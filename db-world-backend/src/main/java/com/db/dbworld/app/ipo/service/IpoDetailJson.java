package com.db.dbworld.app.ipo.service;

import com.db.dbworld.app.ipo.dto.IpoIssueDetailsDto;
import com.db.dbworld.app.ipo.dto.IpoIssueObjectDto;
import com.db.dbworld.app.ipo.dto.IpoKpiDto;
import lombok.extern.log4j.Log4j2;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

import java.util.List;

/**
 * (De)serializes the detail-page KPI and "Objects of the Issue" lists stored as JSON-array strings
 * on {@link com.db.dbworld.app.ipo.entity.IpoListingEntity} ({@code kpis_json},
 * {@code issue_objects_json}). Parallels {@link IpoSubscriptionJson}: never throws — a
 * null/blank/malformed string deserializes to an empty list (logged at WARN); a null/empty list
 * serializes to {@code null} (so ingest's null-property IGNORE keeps a previously-good value
 * instead of wiping it).
 */
@Log4j2
public final class IpoDetailJson {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final TypeReference<List<IpoKpiDto>> KPI_LIST = new TypeReference<>() {};
    private static final TypeReference<List<IpoIssueObjectDto>> OBJECT_LIST = new TypeReference<>() {};

    private IpoDetailJson() {}

    public static String kpisToJson(List<IpoKpiDto> kpis) {
        return toJson(kpis);
    }

    public static List<IpoKpiDto> kpisFromJson(String json) {
        return fromJson(json, KPI_LIST);
    }

    public static String issueObjectsToJson(List<IpoIssueObjectDto> objects) {
        return toJson(objects);
    }

    public static List<IpoIssueObjectDto> issueObjectsFromJson(String json) {
        return fromJson(json, OBJECT_LIST);
    }

    /** Single-object variant (not a list): a null/all-blank object serializes to {@code null} (so
     * ingest's null-property IGNORE keeps a previously-good value instead of wiping it). */
    public static String issueDetailsToJson(IpoIssueDetailsDto issueDetails) {
        if (issueDetails == null || issueDetails.isEmpty()) {
            return null;
        }
        try {
            return MAPPER.writeValueAsString(issueDetails);
        } catch (Exception e) {
            log.warn("Failed to serialize IPO issue-details — storing null: {}", e.toString());
            return null;
        }
    }

    /** A null/blank/malformed string deserializes to {@code null} (logged at WARN). */
    public static IpoIssueDetailsDto issueDetailsFromJson(String json) {
        if (json == null || json.isBlank()) {
            return null;
        }
        try {
            return MAPPER.readValue(json, IpoIssueDetailsDto.class);
        } catch (Exception e) {
            log.warn("Failed to parse IPO issue-details JSON — treating as null: {}", e.toString());
            return null;
        }
    }

    private static String toJson(List<?> list) {
        if (list == null || list.isEmpty()) {
            return null;
        }
        try {
            return MAPPER.writeValueAsString(list);
        } catch (Exception e) {
            log.warn("Failed to serialize IPO detail list — storing null: {}", e.toString());
            return null;
        }
    }

    private static <T> List<T> fromJson(String json, TypeReference<List<T>> type) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            List<T> result = MAPPER.readValue(json, type);
            return result == null ? List.of() : result;
        } catch (Exception e) {
            log.warn("Failed to parse IPO detail JSON — treating as empty: {}", e.toString());
            return List.of();
        }
    }
}
