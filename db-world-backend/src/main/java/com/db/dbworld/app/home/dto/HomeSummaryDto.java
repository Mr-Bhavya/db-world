package com.db.dbworld.app.home.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/**
 * Everything the home dashboard's widgets need, in one response.
 *
 * <p>The hub renders a tile per app and each tile wants a live figure or two. Fetching those from
 * each feature's own endpoint would mean six-plus requests on the most-visited page of the site, so
 * they are aggregated here instead.
 *
 * <p>Every section is nullable and omitted from the JSON when null ({@link JsonInclude}), which is
 * how the endpoint degrades for anonymous visitors: the public sections ({@link IpoSection},
 * {@link CinemaSection}) are always present, the user-scoped ones are simply absent. A widget that
 * gets no section falls back to its static description rather than rendering an empty shell.
 *
 * <p>Two widgets are deliberately NOT here: Arcade reads its high scores from localStorage, and
 * Weather needs the browser's coordinates. Neither is knowable server-side.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record HomeSummaryDto(

        Instant generatedAt,

        /** False for anonymous visitors — lets the client skip "sign in to see yours" prompts. */
        boolean authenticated,

        IpoSection ipo,
        CinemaSection cinema,
        WalletSection wallet,
        VaultSection vault,
        NotificationSection notifications,
        AdminSection admin
) {

    /* ── Public sections ─────────────────────────────────────────────────────────────────────── */

    /**
     * IPO Radar's tile: how many issues are live, the two the user most likely cares about — the
     * one closing soonest and the one with the best grey-market premium — and a short actionable
     * list for the large tile, which has the room for it.
     */
    public record IpoSection(
            int open,
            int upcoming,
            IpoHighlight closingSoon,
            IpoHighlight topGmp,
            /** Issues you can still act on: open ones by soonest close, then upcoming by open date. */
            List<IpoHighlight> actionable
    ) {}

    public record IpoHighlight(
            String id,
            String companyName,
            String logoUrl,
            String status,
            LocalDate openDate,
            LocalDate closeDate,
            BigDecimal gmpPct
    ) {}

    /**
     * Cinema's tile: the newest published titles as poster thumbnails, the shape of the library
     * behind them, and — for a signed-in user with something in flight — the most recent Continue
     * Watching entry. The counts fill the row the resume bar would otherwise occupy, so the tile
     * says something either way instead of padding itself with a second row of the same posters.
     */
    public record CinemaSection(
            List<CinemaTitle> latest,
            ContinueItem continueWatching,
            long publishedTitles,
            long movies,
            long series,
            /** Titles published in the last week — what makes the figures worth re-reading. */
            long addedThisWeek
    ) {}

    public record CinemaTitle(
            Long id,
            String name,
            String type,
            String posterPath
    ) {}

    public record ContinueItem(
            Long recordId,
            String title,
            String type,
            String posterPath,
            Integer season,
            Integer episode,
            int progressPct
    ) {}

    /* ── User-scoped sections (null when anonymous) ──────────────────────────────────────────── */

    /**
     * Wallet's tile, built around expiry because that is the only thing about a stored document
     * that changes on its own. {@code expiringSoon} counts documents due within
     * {@code HomeSummaryService.EXPIRY_WINDOW_DAYS}; already-expired ones are counted separately so
     * the tile can show them in the error colour instead of the warning one.
     */
    public record WalletSection(
            long total,
            long expiringSoon,
            long expired,
            WalletExpiry next
    ) {}

    public record WalletExpiry(
            String id,
            String label,
            LocalDate expiryDate,
            long daysLeft
    ) {}

    /**
     * Vault's tile. Counts only — deliberately. Password strength would make a better widget, but
     * it cannot be computed without decrypting every credential, and the hub is a page anyone can
     * land on; that work stays inside the vault itself, behind the app lock.
     */
    public record VaultSection(long total) {}

    public record NotificationSection(long unread) {}

    public record AdminSection(
            long pendingMediaRequests,
            long pendingCatalogRequests
    ) {}
}
