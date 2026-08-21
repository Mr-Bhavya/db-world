package com.db.dbworld.app.cinema.catalog.tags.rule;

import com.db.dbworld.app.cinema.catalog.entities.RecordEntity;
import com.db.dbworld.app.cinema.enums.RecordType;
import com.db.dbworld.app.cinema.enums.RecordVisibility;
import com.db.dbworld.app.cinema.tmdb.enums.ProviderType;
import com.db.dbworld.app.media.info.entity.MediaFileEntity;
import jakarta.persistence.criteria.From;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Compiles a {@link TagRule} into a JPA {@link Specification}.
 *
 * <p>Admin input becomes bound criteria parameters, never SQL text, so a hostile or malformed rule
 * can at worst match nothing. That is the reason admin-defined tags use this path rather than the
 * native SQL the eight built-in strategies use.
 */
@Log4j2
@Component
@RequiredArgsConstructor
public class TagRuleEvaluator {

    private final TagConditionCompiler conditionCompiler;

    /**
     * Builds the specification for a rule.
     *
     * <p>Always restricted to PUBLISHED records: an automatic tag exists to feed rails, and rails
     * only ever show published titles. Including drafts would inflate the tag's count in the admin UI
     * with records that can never appear.
     */
    public Specification<RecordEntity> toSpecification(TagRule rule) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            // Shared across BOTH halves of the rule so a collection is joined at most once. Without
            // it, two conditions on genres would each create a join and the rule would match
            // nothing — one joined row cannot be two different genres at the same time.
            Map<String, From<?, ?>> joins = TagConditionCompiler.newJoinCache();

            predicates.add(cb.equal(root.get("visibility"), RecordVisibility.PUBLISHED));

            if (rule.getRecordType() != null && !rule.getRecordType().isBlank()) {
                predicates.add(cb.equal(root.get("type"),
                        RecordType.valueOf(rule.getRecordType().toUpperCase())));
            }

            // The tmdb join is needed by most criteria below. Use an inner join so records with no
            // TMDB data drop out rather than throwing.
            var tmdb = root.join("tmdb");

            if (rule.getGenreIds() != null && !rule.getGenreIds().isEmpty()) {
                var genreJoin = tmdb.join("genres");
                joins.put("tmdb.genres", genreJoin);
                predicates.add(genreJoin.get("id").in(rule.getGenreIds()));
                // A record with several matching genres would otherwise appear once per match.
                query.distinct(true);
            }

            if (rule.getLanguages() != null && !rule.getLanguages().isEmpty()) {
                predicates.add(tmdb.get("originalLanguage").in(rule.getLanguages()));
            }

            if (rule.getMinVoteAverage() != null) {
                predicates.add(cb.greaterThanOrEqualTo(
                        tmdb.get("voteAverage"), rule.getMinVoteAverage()));
            }
            if (rule.getMinVoteCount() != null) {
                predicates.add(cb.greaterThanOrEqualTo(
                        tmdb.get("voteCount"), rule.getMinVoteCount()));
            }
            if (rule.getMinPopularity() != null) {
                predicates.add(cb.greaterThanOrEqualTo(
                        tmdb.get("popularity"), rule.getMinPopularity()));
            }

            // primaryDate is a VARCHAR holding an ISO-8601 date, so a lexicographic >= is a correct
            // chronological comparison — the same trick the built-in native strategies use.
            String today = LocalDate.now(ZoneOffset.UTC).toString();

            if (rule.getReleasedWithinDays() != null) {
                String cutoff = LocalDate.now(ZoneOffset.UTC)
                        .minusDays(rule.getReleasedWithinDays()).toString();
                predicates.add(cb.greaterThanOrEqualTo(tmdb.get("primaryDate"), cutoff));
                // Without this a "released in the last 30 days" rule also matches next year's
                // announcements, because a future date is lexicographically greater too.
                predicates.add(cb.lessThanOrEqualTo(tmdb.get("primaryDate"), today));
            }

            // "Coming soon" — dated after today, up to N days out. Excludes blank/unknown dates,
            // which would otherwise sort in as if they were ancient.
            if (rule.getReleasingWithinNextDays() != null && rule.getReleasingWithinNextDays() > 0) {
                String horizon = LocalDate.now(ZoneOffset.UTC)
                        .plusDays(rule.getReleasingWithinNextDays()).toString();
                predicates.add(cb.greaterThan(tmdb.get("primaryDate"), today));
                predicates.add(cb.lessThanOrEqualTo(tmdb.get("primaryDate"), horizon));
            }

            addInstantWindow(predicates, cb, root, "createdAt",   rule.getAddedWithinDays());
            addInstantWindow(predicates, cb, root, "publishedAt", rule.getPublishedWithinDays());
            addInstantWindow(predicates, cb, root, "newContentAt", rule.getNewContentWithinDays());

            if (rule.getRequiresMediaFiles() != null) {
                // EXISTS rather than a join: a record with 12 files must not be counted 12 times.
                Subquery<Long> sub = query.subquery(Long.class);
                Root<MediaFileEntity> file = sub.from(MediaFileEntity.class);
                sub.select(cb.literal(1L))
                   .where(cb.equal(file.get("record").get("id"), root.get("id")));
                // false = NOT EXISTS, i.e. announced but not yet available. That is what makes a
                // Coming Soon rail expressible at all.
                predicates.add(rule.getRequiresMediaFiles()
                        ? cb.exists(sub)
                        : cb.not(cb.exists(sub)));
            }

            // Watch providers ("only on Netflix"). Populated at ingest from TMDB's
            // /watch/providers, so this reflects where TMDB says a title streams.
            if (rule.getProviderIds() != null && !rule.getProviderIds().isEmpty()) {
                var providers = tmdb.join("providers");
                joins.put("tmdb.providers", providers);
                predicates.add(providers.get("provider").get("id").in(rule.getProviderIds()));

                // Default to FLATRATE: "on Netflix" means included with the subscription. Without
                // this a rent-or-buy listing would match too.
                String type = (rule.getProviderType() == null || rule.getProviderType().isBlank())
                        ? "FLATRATE" : rule.getProviderType().toUpperCase();
                predicates.add(cb.equal(providers.get("providerType"), ProviderType.valueOf(type)));

                if (rule.getProviderRegion() != null && !rule.getProviderRegion().isBlank()) {
                    predicates.add(cb.equal(providers.get("regionCode"), rule.getProviderRegion()));
                }
                // A title can list the same provider across regions/types — don't multiply rows.
                query.distinct(true);
            }

            // The generic half. Same predicates, admin-assembled rather than named.
            predicates.addAll(conditionCompiler.compile(rule.getConditions(), root, query, cb, joins));

            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    /** Adds "{field} within the last N days" for an Instant column, skipping null/non-positive N. */
    private void addInstantWindow(List<Predicate> predicates,
                                  jakarta.persistence.criteria.CriteriaBuilder cb,
                                  Root<RecordEntity> root, String field, Integer days) {
        if (days == null || days <= 0) return;
        Instant cutoff = Instant.now().minus(days, ChronoUnit.DAYS);
        predicates.add(cb.greaterThanOrEqualTo(root.get(field), cutoff));
    }
}
