package com.db.dbworld.app.home.service;

import com.db.dbworld.app.cinema.catalog.entities.RecordEntity;
import com.db.dbworld.app.cinema.tmdb.entities.TmdbEntity;
import com.db.dbworld.app.cinema.catalog.repository.RecordRepository;
import com.db.dbworld.app.cinema.catalogrequest.entity.CatalogIngestRequestStatus;
import com.db.dbworld.app.cinema.catalogrequest.service.CatalogIngestRequestService;
import com.db.dbworld.app.cinema.enums.RecordType;
import com.db.dbworld.app.cinema.enums.RecordVisibility;
import com.db.dbworld.app.cinema.mediarequest.entity.MediaRequestStatus;
import com.db.dbworld.app.cinema.mediarequest.service.MediaRequestService;
import com.db.dbworld.app.cinema.notification.repository.UserNotificationRepository;
import com.db.dbworld.app.cinema.progress.dto.ContinueWatchingDto;
import com.db.dbworld.app.cinema.progress.service.WatchProgressService;
import com.db.dbworld.app.home.dto.HomeSummaryDto;
import com.db.dbworld.app.ipo.dto.IpoSummaryDto;
import com.db.dbworld.app.ipo.service.IpoQueryService;
import com.db.dbworld.app.pm.repository.PasswordManagerRepository;
import com.db.dbworld.app.wallet.entity.WalletDocumentEntity;
import com.db.dbworld.app.wallet.repository.WalletDocumentRepository;
import com.db.dbworld.config.AppConstants;
import com.db.dbworld.core.context.UserContext;
import com.db.dbworld.security.dto.CurrentUser;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.function.Supplier;
import java.util.stream.Stream;

/**
 * Builds the home dashboard's one-shot summary by asking each feature module for the one or two
 * figures its widget shows.
 *
 * <p>This is deliberately the only place in the codebase that reaches across module boundaries like
 * this. The alternative — the hub calling six feature endpoints — puts six round trips on the
 * busiest page of the site, and the browse surface is public, so that cost would be paid by every
 * anonymous visitor and every crawler too.
 *
 * <p><b>No section may take the page down.</b> Each is built inside {@link #section(String,
 * Supplier)}, which logs and yields {@code null} on failure. A widget with no data falls back to
 * its static description, so an IPO source outage costs the hub one tile, not the whole response.
 */
@Log4j2
@Service
public class HomeSummaryService {

    /** How far ahead a wallet document counts as "expiring soon". */
    static final int EXPIRY_WINDOW_DAYS = 30;

    /** Poster thumbnails per row on the Cinema tile. Enough to fill the widest tile's row. */
    private static final int TITLES_PER_ROW = 8;

    /** How far back "added this week" reaches. */
    private static final Duration NEW_TITLES_WINDOW = Duration.ofDays(7);

    /** Rows in the large IPO tile's list. Four fits without the tile needing to scroll. */
    private static final int ACTIONABLE_IPOS = 4;

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");

    private static final String STATUS_OPEN = "open";
    private static final String STATUS_UPCOMING = "upcoming";

    private final IpoQueryService ipoQueryService;
    private final RecordRepository recordRepository;
    private final WatchProgressService watchProgressService;
    private final WalletDocumentRepository walletDocumentRepository;
    private final PasswordManagerRepository passwordManagerRepository;
    private final UserNotificationRepository notificationRepository;
    private final MediaRequestService mediaRequestService;
    private final CatalogIngestRequestService catalogIngestRequestService;
    private final UserContext userContext;
    private final Clock clock;

    @Autowired
    public HomeSummaryService(IpoQueryService ipoQueryService,
                              RecordRepository recordRepository,
                              WatchProgressService watchProgressService,
                              WalletDocumentRepository walletDocumentRepository,
                              PasswordManagerRepository passwordManagerRepository,
                              UserNotificationRepository notificationRepository,
                              MediaRequestService mediaRequestService,
                              CatalogIngestRequestService catalogIngestRequestService,
                              UserContext userContext) {
        this(ipoQueryService, recordRepository, watchProgressService, walletDocumentRepository,
                passwordManagerRepository, notificationRepository, mediaRequestService,
                catalogIngestRequestService, userContext, Clock.systemUTC());
    }

    /** Test-friendly constructor with an injectable clock for a deterministic "today" (IST). */
    HomeSummaryService(IpoQueryService ipoQueryService,
                       RecordRepository recordRepository,
                       WatchProgressService watchProgressService,
                       WalletDocumentRepository walletDocumentRepository,
                       PasswordManagerRepository passwordManagerRepository,
                       UserNotificationRepository notificationRepository,
                       MediaRequestService mediaRequestService,
                       CatalogIngestRequestService catalogIngestRequestService,
                       UserContext userContext,
                       Clock clock) {
        this.ipoQueryService = ipoQueryService;
        this.recordRepository = recordRepository;
        this.watchProgressService = watchProgressService;
        this.walletDocumentRepository = walletDocumentRepository;
        this.passwordManagerRepository = passwordManagerRepository;
        this.notificationRepository = notificationRepository;
        this.mediaRequestService = mediaRequestService;
        this.catalogIngestRequestService = catalogIngestRequestService;
        this.userContext = userContext;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public HomeSummaryDto summary() {
        Optional<CurrentUser> user = userContext.optionalUser();
        Long userId = user.map(CurrentUser::userId).orElse(null);

        return new HomeSummaryDto(
                Instant.now(clock),
                userId != null,
                section("ipo", this::ipoSection),
                section("cinema", () -> cinemaSection(userId)),
                userId == null ? null : section("wallet", () -> walletSection(userId)),
                userId == null ? null : section("vault", () -> vaultSection(userId)),
                userId == null ? null : section("notifications", () -> notificationSection(userId)),
                isAdmin(user) ? section("admin", this::adminSection) : null
        );
    }

    /* ── Sections ────────────────────────────────────────────────────────────────────────────── */

    private HomeSummaryDto.IpoSection ipoSection() {
        List<IpoSummaryDto> ipos = ipoQueryService.list(null, null, "date").ipos();

        int open = (int) ipos.stream().filter(i -> STATUS_OPEN.equals(i.status())).count();
        int upcoming = (int) ipos.stream().filter(i -> STATUS_UPCOMING.equals(i.status())).count();

        // Soonest close among issues still open — the one a user can still act on today.
        IpoSummaryDto closingSoon = ipos.stream()
                .filter(i -> STATUS_OPEN.equals(i.status()) && i.closeDate() != null)
                .min(Comparator.comparing(IpoSummaryDto::closeDate))
                .orElse(null);

        // Best premium among issues you can still apply for. An already-listed IPO's GMP is
        // history, so including it would headline a number nobody can act on.
        IpoSummaryDto topGmp = ipos.stream()
                .filter(i -> i.gmpPct() != null)
                .filter(i -> STATUS_OPEN.equals(i.status()) || STATUS_UPCOMING.equals(i.status()))
                .max(Comparator.comparing(IpoSummaryDto::gmpPct))
                .orElse(null);

        // The large tile lists what is still actionable: open issues by soonest close (decide now),
        // then upcoming by open date (diary it). Everything else is either history or noise.
        List<HomeSummaryDto.IpoHighlight> actionable = Stream.concat(
                        ipos.stream()
                                .filter(i -> STATUS_OPEN.equals(i.status()))
                                .sorted(Comparator.comparing(IpoSummaryDto::closeDate,
                                        Comparator.nullsLast(Comparator.naturalOrder()))),
                        ipos.stream()
                                .filter(i -> STATUS_UPCOMING.equals(i.status()))
                                .sorted(Comparator.comparing(IpoSummaryDto::openDate,
                                        Comparator.nullsLast(Comparator.naturalOrder()))))
                .limit(ACTIONABLE_IPOS)
                .map(HomeSummaryService::highlight)
                .toList();

        return new HomeSummaryDto.IpoSection(
                open, upcoming, highlight(closingSoon), highlight(topGmp), actionable);
    }

    private HomeSummaryDto.CinemaSection cinemaSection(Long userId) {
        List<HomeSummaryDto.CinemaTitle> latest =
                recordRepository.findLatestPublished(PageRequest.of(0, TITLES_PER_ROW)).stream()
                        .map(HomeSummaryService::title)
                        .toList();

        HomeSummaryDto.ContinueItem resume = userId == null ? null
                : watchProgressService.getContinueWatching(userId).stream()
                        .findFirst()
                        .map(HomeSummaryService::resumeItem)
                        .orElse(null);

        Instant weekAgo = Instant.now(clock).minus(NEW_TITLES_WINDOW);

        return new HomeSummaryDto.CinemaSection(
                latest,
                resume,
                recordRepository.countByVisibility(RecordVisibility.PUBLISHED),
                recordRepository.countByVisibilityAndType(RecordVisibility.PUBLISHED, RecordType.MOVIE),
                recordRepository.countByVisibilityAndType(RecordVisibility.PUBLISHED, RecordType.TV_SERIES),
                recordRepository.countByVisibilityAndPublishedAtAfter(RecordVisibility.PUBLISHED, weekAgo)
        );
    }

    private HomeSummaryDto.WalletSection walletSection(Long userId) {
        LocalDate today = LocalDate.now(clock.withZone(IST));

        HomeSummaryDto.WalletExpiry next = walletDocumentRepository
                .findByUserIdAndExpiryDateGreaterThanEqualOrderByExpiryDateAsc(
                        userId, today, PageRequest.of(0, 1))
                .stream()
                .findFirst()
                .map(doc -> expiry(doc, today))
                .orElse(null);

        return new HomeSummaryDto.WalletSection(
                walletDocumentRepository.countByUserId(userId),
                walletDocumentRepository.countByUserIdAndExpiryDateBetween(
                        userId, today, today.plusDays(EXPIRY_WINDOW_DAYS)),
                walletDocumentRepository.countByUserIdAndExpiryDateBefore(userId, today),
                next
        );
    }

    private HomeSummaryDto.VaultSection vaultSection(Long userId) {
        return new HomeSummaryDto.VaultSection(
                passwordManagerRepository.countByUserEntityUserId(userId));
    }

    private HomeSummaryDto.NotificationSection notificationSection(Long userId) {
        return new HomeSummaryDto.NotificationSection(
                notificationRepository.countByRecipientUserIdAndReadFalse(userId));
    }

    private HomeSummaryDto.AdminSection adminSection() {
        return new HomeSummaryDto.AdminSection(
                mediaRequestService.countByStatus(MediaRequestStatus.PENDING),
                catalogIngestRequestService.countByStatus(CatalogIngestRequestStatus.PENDING)
        );
    }

    /* ── Mapping helpers ─────────────────────────────────────────────────────────────────────── */

    private static HomeSummaryDto.IpoHighlight highlight(IpoSummaryDto ipo) {
        return ipo == null ? null : new HomeSummaryDto.IpoHighlight(
                ipo.id(), ipo.companyName(), ipo.logoUrl(),
                ipo.status(), ipo.openDate(), ipo.closeDate(), ipo.gmpPct());
    }

    private static HomeSummaryDto.CinemaTitle title(RecordEntity record) {
        TmdbEntity tmdb = record.getTmdb();
        return new HomeSummaryDto.CinemaTitle(
                record.getId(),
                tmdb != null && tmdb.getTitle() != null ? tmdb.getTitle() : record.getName(),
                record.getType() == null ? null : record.getType().name(),
                tmdb == null ? null : tmdb.getPosterPath()
        );
    }

    private static HomeSummaryDto.ContinueItem resumeItem(ContinueWatchingDto dto) {
        return new HomeSummaryDto.ContinueItem(
                dto.getRecordId(),
                dto.getTitle(),
                dto.getType(),
                dto.getPosterPath(),
                dto.getSeason(),
                dto.getEpisode(),
                progressPct(dto.getPositionMs(), dto.getDurationMs())
        );
    }

    /**
     * Percent watched, clamped to 0–100. Duration is 0 when unknown — a queued next episode the
     * user has never opened — and that must read as "not started", not divide by zero.
     */
    private static int progressPct(long positionMs, long durationMs) {
        if (durationMs <= 0 || positionMs <= 0) return 0;
        return (int) Math.clamp(Math.round(positionMs * 100.0 / durationMs), 0, 100);
    }

    private static HomeSummaryDto.WalletExpiry expiry(WalletDocumentEntity doc, LocalDate today) {
        return new HomeSummaryDto.WalletExpiry(
                doc.getId(),
                doc.getLabel(),
                doc.getExpiryDate(),
                ChronoUnit.DAYS.between(today, doc.getExpiryDate())
        );
    }

    private static boolean isAdmin(Optional<CurrentUser> user) {
        return user.map(CurrentUser::role)
                .filter(role -> AppConstants.OWNER.equals(role) || AppConstants.ADMIN.equals(role))
                .isPresent();
    }

    /**
     * Runs one section's build, swallowing any failure into a {@code null} section.
     *
     * <p>The hub aggregates seven independent subsystems; without this, any one of them being down
     * — a dead IPO feed, a wallet storage hiccup — returns a 500 for the site's landing page.
     */
    private <T> T section(String name, Supplier<T> build) {
        try {
            return build.get();
        } catch (Exception e) {
            log.warn("Home summary section '{}' failed; omitting it from the response", name, e);
            return null;
        }
    }
}
