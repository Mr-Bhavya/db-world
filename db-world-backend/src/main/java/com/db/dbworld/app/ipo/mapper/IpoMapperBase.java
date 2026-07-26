package com.db.dbworld.app.ipo.mapper;

import com.db.dbworld.app.ipo.dto.*;
import com.db.dbworld.app.ipo.entity.*;
import com.db.dbworld.app.ipo.service.IpoDetailJson;
import com.db.dbworld.app.ipo.service.IpoSubscriptionJson;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;
import org.mapstruct.Named;
import org.mapstruct.NullValuePropertyMappingStrategy;
import org.mapstruct.ReportingPolicy;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

/**
 * MapStruct core of {@link IpoMapper}. The straightforward entity/DTO mappings below are abstract
 * methods that MapStruct implements (in the generated {@code IpoMapperBaseImpl}); the two mappings
 * with genuinely custom logic ({@link #toSubscriptionPoint} and {@link #toMyIpoDto}) stay
 * hand-written here — the equivalent of a "default" method on a MapStruct interface.
 *
 * <p>This is an abstract CLASS rather than the more usual MapStruct interface purely so
 * {@link IpoMapper} can {@code extend} the generated implementation and remain a plain concrete,
 * directly-instantiable type: several existing unit tests construct the mapper via
 * {@code new IpoMapper()} rather than through Spring, which an interface (or an abstract type used
 * directly as the bean) could not support. {@code componentModel = "default"} (explicitly
 * overriding the module-wide {@code -Amapstruct.defaultComponentModel=spring} compiler arg) keeps
 * the generated {@code IpoMapperBaseImpl} a plain POJO rather than a second, unwanted Spring bean —
 * {@link IpoMapper} is the only bean callers ever see.
 */
@Mapper(
        componentModel = "default",
        nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE,
        unmappedTargetPolicy = ReportingPolicy.IGNORE
)
public abstract class IpoMapperBase {

    public abstract IpoSummaryDto toSummary(IpoListingEntity e);

    @Mapping(target = "strengths", source = "strengths", qualifiedByName = "splitLines")
    @Mapping(target = "risks", source = "risks", qualifiedByName = "splitLines")
    @Mapping(target = "leadManagers", source = "leadManagers", qualifiedByName = "splitLines")
    @Mapping(target = "kpis", source = "kpisJson", qualifiedByName = "kpisFromJson")
    @Mapping(target = "issueObjects", source = "issueObjectsJson", qualifiedByName = "issueObjectsFromJson")
    public abstract IpoDetailDto toDetail(IpoListingEntity e);

    public abstract IpoFinancialDto toFinancial(IpoFinancialEntity e);

    @Mapping(target = "t", source = "capturedAt")
    public abstract GmpPointDto toGmpPoint(IpoGmpHistoryEntity e);

    public abstract IpoChangeDto toChangeDto(IpoChangeEventEntity e);

    public abstract SourceHealthDto toSourceHealth(IpoSourcePollEntity e);

    public abstract IpoApplicationDto toApplicationDto(IpoUserApplicationEntity e);

    /**
     * Builds a brand-new entity from a merged dto. Does not set {@code id}, {@code firstSeenAt},
     * {@code lastSeenAt} or {@code updatedAt} — those are the ingest service's responsibility (id
     * is DB-generated; the timestamps depend on ingest's clock, not the mapper's) — nor the
     * company "About" fields ({@code foundedYear}/{@code managingDirector}/{@code parentCompany}/
     * {@code sector}/{@code headquarters}/{@code website}) or {@code logoDomain}, none of which
     * are part of {@link IpoDto} and are deliberately excluded from ingest so a live poll can
     * never touch them.
     */
    @Mapping(target = "id", ignore = true)
    @Mapping(target = "firstSeenAt", ignore = true)
    @Mapping(target = "lastSeenAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    @Mapping(target = "foundedYear", ignore = true)
    @Mapping(target = "managingDirector", ignore = true)
    @Mapping(target = "parentCompany", ignore = true)
    @Mapping(target = "sector", ignore = true)
    @Mapping(target = "headquarters", ignore = true)
    @Mapping(target = "website", ignore = true)
    @Mapping(target = "logoDomain", ignore = true)
    @Mapping(target = "kpisJson", source = "kpis", qualifiedByName = "kpisToJson")
    @Mapping(target = "issueObjectsJson", source = "issueObjects", qualifiedByName = "issueObjectsToJson")
    public abstract IpoListingEntity toNewEntity(IpoDto dto);

    /**
     * Copies every non-null field from {@code dto} onto {@code entity}, leaving fields the dto
     * didn't report (null) untouched — so a source that drops a field on one poll doesn't wipe
     * previously-good data. {@code nullValuePropertyMappingStrategy = IGNORE} (set on the
     * {@code @Mapper} above) is what makes this a per-field no-op instead of an unconditional
     * overwrite. Never touches {@code id}, {@code matchKey}, or the seen/updated timestamps, nor
     * the company "About" fields or {@code logoDomain}; those are ingest's (or the seeder's)
     * responsibility, never a live poll's.
     */
    @Mapping(target = "id", ignore = true)
    @Mapping(target = "matchKey", ignore = true)
    @Mapping(target = "firstSeenAt", ignore = true)
    @Mapping(target = "lastSeenAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    @Mapping(target = "foundedYear", ignore = true)
    @Mapping(target = "managingDirector", ignore = true)
    @Mapping(target = "parentCompany", ignore = true)
    @Mapping(target = "sector", ignore = true)
    @Mapping(target = "headquarters", ignore = true)
    @Mapping(target = "website", ignore = true)
    @Mapping(target = "logoDomain", ignore = true)
    @Mapping(target = "kpisJson", source = "kpis", qualifiedByName = "kpisToJson")
    @Mapping(target = "issueObjectsJson", source = "issueObjects", qualifiedByName = "issueObjectsToJson")
    public abstract void applyUpdatable(IpoDto dto, @MappingTarget IpoListingEntity entity);

    /** Joins a saved application with a light summary of the IPO it's for, for the "My IPOs" list. */
    public MyIpoDto toMyIpoDto(IpoUserApplicationEntity application, IpoListingEntity ipo) {
        return new MyIpoDto(toApplicationDto(application), toSummary(ipo));
    }

    /**
     * {@code categories} is deserialized from the entity's JSON column (never null — an empty
     * map for null/blank/malformed JSON, see {@link IpoSubscriptionJson#fromJson}); {@code qib}/
     * {@code nii}/{@code retail} are derived from it (case-insensitive lookup, {@code null} if
     * that category is absent) purely for frontend back-compat during the categories migration.
     */
    public SubscriptionPointDto toSubscriptionPoint(IpoSubscriptionHistoryEntity e) {
        Map<String, BigDecimal> categories = IpoSubscriptionJson.fromJson(e.getCategoriesJson());
        return new SubscriptionPointDto(e.getCapturedAt(), e.getTotal(), categories,
                findCategory(categories, "qib"), findCategory(categories, "nii"), findCategory(categories, "retail"));
    }

    /** Case-insensitive lookup of one category's value; {@code null} if absent. */
    private static BigDecimal findCategory(Map<String, BigDecimal> categories, String key) {
        for (Map.Entry<String, BigDecimal> entry : categories.entrySet()) {
            if (entry.getKey() != null && entry.getKey().equalsIgnoreCase(key)) {
                return entry.getValue();
            }
        }
        return null;
    }

    /** Splits newline-delimited TEXT (as stored on the entity) into trimmed, non-blank lines; null/blank → empty list. */
    @Named("splitLines")
    protected static List<String> splitLines(String raw) {
        if (raw == null || raw.isBlank()) {
            return List.of();
        }
        return Arrays.stream(raw.split("\n"))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
    }

    // ── KPI / Objects-of-the-Issue JSON <-> list converters (delegated to IpoDetailJson) ────────
    @Named("kpisToJson")
    protected static String kpisToJson(List<IpoKpiDto> kpis) {
        return IpoDetailJson.kpisToJson(kpis);
    }

    @Named("kpisFromJson")
    protected static List<IpoKpiDto> kpisFromJson(String json) {
        return IpoDetailJson.kpisFromJson(json);
    }

    @Named("issueObjectsToJson")
    protected static String issueObjectsToJson(List<IpoIssueObjectDto> objects) {
        return IpoDetailJson.issueObjectsToJson(objects);
    }

    @Named("issueObjectsFromJson")
    protected static List<IpoIssueObjectDto> issueObjectsFromJson(String json) {
        return IpoDetailJson.issueObjectsFromJson(json);
    }
}
