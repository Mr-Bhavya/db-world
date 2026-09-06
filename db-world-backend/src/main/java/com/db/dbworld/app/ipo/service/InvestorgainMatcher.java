package com.db.dbworld.app.ipo.service;

import com.db.dbworld.app.ipo.entity.IpoListingEntity;
import com.db.dbworld.app.ipo.repository.IpoListingRepository;

import lombok.extern.log4j.Log4j2;

import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Resolves an investorgain feed row to the IPO listing we already track. Shared by every
 * investorgain reader so there is exactly one answer to "which of our IPOs is this row about".
 *
 * <p>Resolution is a three-step ladder, cheapest and most reliable first:
 * <ol>
 *   <li><b>Stored id.</b> Once an IPO has been matched, {@code investorgainId} is stamped on it and
 *       every later poll is a straight id lookup. This is the whole point of the class — see below
 *       for why matching by name every time was losing IPOs.</li>
 *   <li><b>Exact squashed name.</b> Lowercase, legal suffixes removed, then EVERY non-alphanumeric
 *       dropped including whitespace. That last part is load-bearing: investorgain writes
 *       {@code "G.V. Electricals"} where we store {@code "G.V.Electricals Ltd."}, and stripping only
 *       punctuation leaves {@code "gv electricals"} against {@code "gvelectricals"} — the space is
 *       the entire difference.</li>
 *   <li><b>Name prefix.</b> Their report carries a SHORT name ({@code company_short_name}), so the
 *       feed value is frequently a prefix of ours and never equal: {@code "Skyways Air"} for
 *       {@code "Skyways Air Services Limited"}, {@code "Gaja Alternative Asset"} for
 *       {@code "… Management Ltd."}, even {@code "Complete Sports and"} cut mid-name. Several
 *       candidates are narrowed by open date, and anything still ambiguous is skipped rather than
 *       mis-attributed.</li>
 * </ol>
 *
 * <p><b>Do not "fix" this by changing {@link IpoNormalizer}.</b> Its {@code matchKey} is the ingest
 * dedup key stored on every row; a lossier formula there would orphan every stored listing and
 * duplicate the whole catalogue on the next poll. The comparison here is deliberately separate —
 * it only ever has to compare two names, never serve as a stable identity.
 */
@Log4j2
@Component
public class InvestorgainMatcher {

    /** Shortest squashed feed name allowed to prefix-match a longer stored name. */
    private static final int MIN_PREFIX_LENGTH = 6;

    private final IpoListingRepository listingRepo;
    private final IpoNormalizer normalizer;

    public InvestorgainMatcher(IpoListingRepository listingRepo, IpoNormalizer normalizer) {
        this.listingRepo = listingRepo;
        this.normalizer = normalizer;
    }

    /**
     * Snapshots every tracked listing into an in-memory index — one query per pass instead of one
     * per feed row. The table holds a financial year or two of IPOs, so this is small, and matching
     * in memory is what allows the fuzzy comparison the stored key can't express.
     */
    public Index loadIndex() {
        Map<Integer, IpoListingEntity> byId = new HashMap<>();
        Map<String, List<IpoListingEntity>> byName = new LinkedHashMap<>();
        for (IpoListingEntity entity : listingRepo.findAll()) {
            if (entity.getInvestorgainId() != null) {
                byId.put(entity.getInvestorgainId(), entity);
            }
            String squashed = squash(entity.getCompanyName());
            if (squashed != null) {
                byName.computeIfAbsent(squashed, k -> new ArrayList<>()).add(entity);
            }
        }
        return new Index(byId, byName);
    }

    /** A single pass's view of the tracked listings, keyed both by investorgain id and by name. */
    public record Index(Map<Integer, IpoListingEntity> byId, Map<String, List<IpoListingEntity>> byName) {}

    /**
     * The tracked listing this row is about, or {@code null} if we don't track it. On a name-based
     * hit the row's {@code investorgainId} is stamped onto the entity (the caller persists it), so
     * the name comparison is a one-time bootstrap per IPO rather than a gamble every poll.
     */
    public IpoListingEntity resolve(Index index, Integer investorgainId, String companyName, LocalDate openDate) {
        if (investorgainId != null) {
            IpoListingEntity byId = index.byId().get(investorgainId);
            if (byId != null) {
                return byId;
            }
        }
        IpoListingEntity matched = resolveByName(index, companyName, openDate);
        if (matched != null && investorgainId != null && matched.getInvestorgainId() == null) {
            matched.setInvestorgainId(investorgainId);
            log.info("investorgain: learned id {} for '{}' (feed name '{}') — future polls match by id",
                    investorgainId, matched.getCompanyName(), companyName);
        }
        return matched;
    }

    private IpoListingEntity resolveByName(Index index, String companyName, LocalDate openDate) {
        String squashed = squash(companyName);
        if (squashed == null) {
            return null;
        }
        List<IpoListingEntity> hits = index.byName().get(squashed);
        if (hits == null && squashed.length() >= MIN_PREFIX_LENGTH) {
            hits = index.byName().entrySet().stream()
                    .filter(e -> e.getKey().startsWith(squashed))
                    .flatMap(e -> e.getValue().stream())
                    .toList();
        }
        if (hits == null || hits.isEmpty()) {
            log.debug("investorgain: no tracked IPO for '{}' (squashed='{}', open={})",
                    companyName, squashed, openDate);
            return null;
        }
        if (hits.size() == 1) {
            return hits.get(0);
        }
        List<IpoListingEntity> sameOpenDate = hits.stream()
                .filter(e -> openDate != null && openDate.equals(e.getOpenDate()))
                .toList();
        if (sameOpenDate.size() == 1) {
            return sameOpenDate.get(0);
        }
        log.debug("investorgain: ambiguous name '{}' (squashed='{}') — {} tracked IPOs match, {} share its "
                + "open date; skipped", companyName, squashed, hits.size(), sameOpenDate.size());
        return null;
    }

    /**
     * A company name reduced to bare lowercase alphanumerics with legal suffixes removed. Built off
     * {@link IpoNormalizer#matchKey} (so the suffix list stays in one place) with the trailing
     * separator and all whitespace stripped.
     */
    private String squash(String companyName) {
        String normalized = normalizer.matchKey(companyName, null);
        if (normalized == null) {
            return null;
        }
        String squashed = normalized.substring(0, normalized.length() - 1).replace(" ", "");
        return squashed.isEmpty() ? null : squashed;
    }
}
