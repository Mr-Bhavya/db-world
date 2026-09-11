package com.db.dbworld.app.ipo.service;

import com.db.dbworld.app.ipo.dto.IpoDto;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Builds the two name-derived keys the IPO pipeline identifies a company by.
 *
 * <p><b>{@link #matchKey(IpoDto)} is the stored identity</b> — the UNIQUE {@code match_key} column
 * that {@code IpoIngestService} looks rows up by and {@link IpoMergeService} groups a poll batch by.
 * Its formula is frozen: it is persisted on every row, so loosening it in place would orphan the
 * whole catalogue on the next poll.
 *
 * <p><b>{@link #aliasKey(String)} is the resolution key</b> — deliberately much lossier, recomputed
 * on demand, and stored only behind a non-unique index. It exists because {@code matchKey} cannot
 * reconcile the three feeds' house styles, and so lets one company become several rows:
 * <ul>
 *   <li>{@code matchKey} DELETES punctuation rather than replacing it, gluing tokens together, so
 *       Chittorgarh's {@code "Asset Reconstruction Co.(India) Ltd."} keys as
 *       {@code "asset reconstruction coindia"} while NSE's {@code "... Company (India) Limited"}
 *       keys as {@code "asset reconstruction company india"};</li>
 *   <li>it does no abbreviation folding, so {@code "&"} and {@code "and"} split a company in two;</li>
 *   <li>it keeps whitespace, so {@code "AnawilWire"} and {@code "Anawil Wire"} are different rows —
 *       and, because those two DO collapse to one name here, {@code InvestorgainMatcher} then sees
 *       an ambiguous pair and refuses to attribute GMP to EITHER of them.</li>
 * </ul>
 * The alias key folds all three away: {@code &} becomes {@code and}, punctuation becomes a
 * SEPARATOR rather than nothing, common abbreviations are expanded, trailing legal suffixes are
 * dropped, and finally all whitespace is squashed out.
 *
 * <p>It is intentionally aggressive, which means it CAN over-merge — a company's SME issue and its
 * later mainboard issue share a byte-identical name. Callers must therefore treat an alias hit as a
 * CANDIDATE and apply their own guard (date overlap for ingest, the ambiguity check for the
 * matcher), and {@code IpoDuplicateService} reports before it merges.
 */
@Component
public class IpoNormalizer {

    /** Checked longest-most-specific first so e.g. "ltd." isn't shadowed by a looser match. */
    private static final List<String> LEGAL_SUFFIXES = List.of("limited", "private", "ltd.", "pvt.", "ltd", "pvt");

    private static final Pattern NON_ALPHANUMERIC = Pattern.compile("[^a-z0-9\\s]");
    private static final Pattern WHITESPACE = Pattern.compile("\\s+");

    /** Alias key: every run of non-alphanumerics is a token SEPARATOR, not nothing. */
    private static final Pattern NON_ALPHANUMERIC_ALIAS = Pattern.compile("[^a-z0-9]+");

    /** Legal-suffix TOKENS dropped from an alias key's tail (post-expansion, so "pvt" reads as "private"). */
    private static final Set<String> ALIAS_LEGAL_TOKENS = Set.of("limited", "private", "llp");

    /**
     * Abbreviation to expansion, applied per token when building an alias key. Deliberately short:
     * every entry is a pair the Indian IPO feeds genuinely disagree on, and each one widens the set
     * of names that collapse together, so a wrong entry manufactures false duplicates. Forms that
     * are real company-name words in their own right (e.g. "tech" against "technologies") are left
     * alone — fusing two unrelated issuers is far worse than missing a merge.
     */
    private static final Map<String, String> ABBREVIATIONS = Map.ofEntries(
            Map.entry("co", "company"),
            Map.entry("cos", "companies"),
            Map.entry("corp", "corporation"),
            Map.entry("corpn", "corporation"),
            Map.entry("intl", "international"),
            Map.entry("intnl", "international"),
            Map.entry("inds", "industries"),
            Map.entry("indus", "industries"),
            Map.entry("engg", "engineering"),
            Map.entry("mfg", "manufacturing"),
            Map.entry("mfrs", "manufacturers"),
            Map.entry("pvt", "private"),
            Map.entry("ltd", "limited"));

    /**
     * @return {@code normalize(companyName) + "|" + openDate}, or {@code null} if the dto has
     * no usable company name (uningestable — nothing to key on).
     */
    public String matchKey(IpoDto dto) {
        return dto == null ? null : matchKey(dto.companyName(), dto.openDate());
    }

    /**
     * Same dedup key from a raw company name + open date — lets a non-{@link IpoDto} caller (e.g.
     * the investorgain GMP refresh) look an already-ingested listing up by {@code matchKey} without
     * having to build a throwaway dto. {@code null} if the name normalises to empty.
     */
    public String matchKey(String companyName, LocalDate openDate) {
        if (companyName == null || companyName.isBlank()) {
            return null;
        }
        String name = normalize(companyName);
        if (name.isEmpty()) {
            return null;
        }
        return name + "|" + (openDate == null ? "" : openDate.toString());
    }

    /**
     * The date-free, punctuation-free, abbreviation-folded, whitespace-free form of a company name —
     * the key that duplicate rows of one company agree on even when their {@code matchKey}s do not.
     * {@code null} when nothing identifiable is left.
     */
    public String aliasKey(String companyName) {
        if (companyName == null || companyName.isBlank()) {
            return null;
        }
        String[] tokens = NON_ALPHANUMERIC_ALIAS.split(companyName.toLowerCase().replace("&", " and "));
        StringBuilder alias = new StringBuilder();
        // Walk backwards so a run of trailing legal suffixes ("... Private Limited") peels off in a
        // single pass, while the same word EARLIER in the name (e.g. "Private Sector Bank Ltd") is
        // kept — there it is part of the company name, not a suffix.
        boolean stillTrailing = true;
        for (int i = tokens.length - 1; i >= 0; i--) {
            String token = ABBREVIATIONS.getOrDefault(tokens[i], tokens[i]);
            if (token.isEmpty()) {
                continue;
            }
            if (stillTrailing && ALIAS_LEGAL_TOKENS.contains(token)) {
                continue;
            }
            stillTrailing = false;
            alias.insert(0, token);
        }
        return alias.isEmpty() ? null : alias.toString();
    }

    private String normalize(String companyName) {
        String s = companyName.toLowerCase().trim();
        // Repeatedly strip trailing legal-suffix tokens (a name can carry more than one, e.g.
        // "XYZ Private Limited") until none remain, so all legal-suffix variants of a company
        // collapse onto the same key.
        boolean strippedSomething = true;
        while (strippedSomething) {
            strippedSomething = false;
            for (String suffix : LEGAL_SUFFIXES) {
                if (s.endsWith(suffix)) {
                    s = s.substring(0, s.length() - suffix.length()).trim();
                    strippedSomething = true;
                    break;
                }
            }
        }
        s = NON_ALPHANUMERIC.matcher(s).replaceAll("");
        s = WHITESPACE.matcher(s.trim()).replaceAll(" ");
        return s.trim();
    }
}
