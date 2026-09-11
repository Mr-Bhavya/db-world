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
 * <p>Resolution is a four-step ladder, most reliable first:
 * <ol>
 *   <li><b>Stored id.</b> Once an IPO has been matched, {@code investorgainId} is stamped on it and
 *       every later poll is a straight id lookup. This is the whole point of the class — see below
 *       for why matching by name every time was losing IPOs.</li>
 *   <li><b>Exact alias key.</b> {@link IpoNormalizer#aliasKey(String)}: lowercase, ampersands and
 *       common abbreviations folded, legal suffixes removed, then EVERY non-alphanumeric dropped
 *       including whitespace. That last part is load-bearing: investorgain writes
 *       {@code "G.V. Electricals"} where we store {@code "G.V.Electricals Ltd."}, and stripping only
 *       punctuation leaves {@code "gv electricals"} against {@code "gvelectricals"} — the space is
 *       the entire difference.</li>
 *   <li><b>Their name prefixes ours.</b> Their report carries a SHORT name
 *       ({@code company_short_name}), so the feed value is frequently a prefix of ours and never
 *       equal: {@code "Skyways Air"} for {@code "Skyways Air Services Limited"}.</li>
 *   <li><b>Ours prefixes theirs.</b> The mirror case, which used to be a dead end: their short name
 *       can carry a token our stored name does not, making it LONGER, e.g. their
 *       {@code "Complete Sports and"} against our {@code "Complete Sports"}. A one-directional
 *       prefix test simply lost those IPOs, and lost GMP with them.</li>
 * </ol>
 * The tiers are tried in order and the first one to produce any hit wins, so a weak prefix match
 * can never dilute a strong exact one. Several candidates within a tier are narrowed by open date,
 * and anything still ambiguous is skipped rather than mis-attributed.
 *
 * <p><b>Do not "fix" this by changing {@link IpoNormalizer#matchKey}.</b> That is the ingest dedup
 * key stored on every row; a lossier formula there would orphan every stored listing and duplicate
 * the whole catalogue on the next poll. The alias key used here is deliberately separate and
 * non-unique — it only ever has to compare two names, never serve as a stable identity.
 */
@Log4j2
@Component
public class InvestorgainMatcher {

    /**
     * Shortest alias allowed to take part in a prefix match, in EITHER direction. Their feed
     * contains junk rows with names as short as {@code "NSE"}, and a three-character prefix would
     * happily attach one to any company whose name starts the same way.
     */
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
     * in memory is what allows the fuzzy comparison the stored key cannot express.
     *
     * <p>Reads only LIVE rows: a listing merged away as a duplicate must not appear here, or the
     * pair it was merged out of would look ambiguous all over again and both halves would be
     * skipped.
     */
    public Index loadIndex() {
        Map<Integer, IpoListingEntity> byId = new HashMap<>();
        Map<String, List<IpoListingEntity>> byName = new LinkedHashMap<>();
        for (IpoListingEntity entity : listingRepo.findAllLive()) {
            if (entity.getInvestorgainId() != null) {
                byId.put(entity.getInvestorgainId(), entity);
            }
            String alias = aliasOf(entity);
            if (alias != null) {
                byName.computeIfAbsent(alias, k -> new ArrayList<>()).add(entity);
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
        String alias = normalizer.aliasKey(companyName);
        if (alias == null) {
            return null;
        }
        List<IpoListingEntity> hits = candidates(index, alias);
        if (hits.isEmpty()) {
            log.debug("investorgain: no tracked IPO for '{}' (alias='{}', open={})",
                    companyName, alias, openDate);
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
        log.debug("investorgain: ambiguous name '{}' (alias='{}') — {} tracked IPOs match, {} share its "
                + "open date; skipped", companyName, alias, hits.size(), sameOpenDate.size());
        return null;
    }

    /**
     * Candidates for one feed alias, strongest tier first: exact, then their-name-prefixes-ours,
     * then ours-prefixes-theirs. Returning the first non-empty tier (rather than the union) keeps a
     * loose prefix hit from making an exact hit look ambiguous.
     */
    private List<IpoListingEntity> candidates(Index index, String alias) {
        List<IpoListingEntity> exact = index.byName().get(alias);
        if (exact != null && !exact.isEmpty()) {
            return exact;
        }
        if (alias.length() < MIN_PREFIX_LENGTH) {
            return List.of();
        }
        List<IpoListingEntity> theirsPrefixesOurs = matching(index, stored -> stored.startsWith(alias));
        if (!theirsPrefixesOurs.isEmpty()) {
            return theirsPrefixesOurs;
        }
        return matching(index, stored -> stored.length() >= MIN_PREFIX_LENGTH && alias.startsWith(stored));
    }

    private static List<IpoListingEntity> matching(Index index, java.util.function.Predicate<String> storedAliasTest) {
        return index.byName().entrySet().stream()
                .filter(e -> storedAliasTest.test(e.getKey()))
                .flatMap(e -> e.getValue().stream())
                .toList();
    }

    /**
     * A stored listing's alias key. Prefers the persisted column (written at ingest, backfilled on
     * boot) and recomputes only when it is still null, so a row created before the column existed
     * still participates in matching within the same pass that backfills it.
     */
    private String aliasOf(IpoListingEntity entity) {
        String stored = entity.getAliasKey();
        return stored != null && !stored.isBlank() ? stored : normalizer.aliasKey(entity.getCompanyName());
    }
}
