package com.db.dbworld.app.cinema.mediarequest.service.impl;

import com.db.dbworld.app.cinema.catalog.entities.RecordEntity;
import com.db.dbworld.app.cinema.catalog.repository.RecordRepository;
import com.db.dbworld.app.cinema.enums.RecordType;
import com.db.dbworld.app.cinema.mediarequest.dto.MediaRequestScopeSummary;
import com.db.dbworld.app.cinema.mediarequest.dto.MediaRequestVoteResponse;
import com.db.dbworld.app.cinema.mediarequest.dto.MyMediaRequestEntry;
import com.db.dbworld.app.cinema.mediarequest.entity.MediaRequestEntity;
import com.db.dbworld.app.cinema.mediarequest.entity.MediaRequestKind;
import com.db.dbworld.app.cinema.mediarequest.entity.MediaRequestScope;
import com.db.dbworld.app.cinema.mediarequest.entity.MediaRequestStatus;
import com.db.dbworld.app.cinema.mediarequest.repository.MediaRequestRepository;
import com.db.dbworld.app.cinema.notification.service.UserNotificationService;
import com.db.dbworld.core.exception.DbWorldException;
import com.db.dbworld.core.push.PushService;
import com.db.dbworld.core.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;

import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Season/episode-scoped media requests: which row a vote lands on, what the queue and the
 * voter notifications say it was for, and the two shapes that are nonsense (an episode with
 * no season; any scope at all on a movie).
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MediaRequestServiceImplTest {

    private static final long RECORD_ID = 42L;
    private static final long ME = 7L;
    private static final long SOMEONE_ELSE = 8L;

    @Mock MediaRequestRepository requestRepo;
    @Mock RecordRepository recordRepo;
    @Mock UserRepository userRepo;
    @Mock UserNotificationService notifService;
    @Mock PushService pushService;

    MediaRequestServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new MediaRequestServiceImpl(requestRepo, recordRepo, userRepo, notifService, pushService);
        // save() returns the managed instance; the impl reads getId() off the result.
        when(requestRepo.save(any(MediaRequestEntity.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private void givenRecord(RecordType type) {
        when(recordRepo.findById(RECORD_ID)).thenReturn(Optional.of(RecordEntity.builder()
                .id(RECORD_ID)
                .name("Breaking Bad")
                .type(type)
                .build()));
    }

    private MediaRequestEntity existing(int season, int episode, Set<Long> voters) {
        MediaRequestEntity e = MediaRequestEntity.builder()
                .id(1L)
                .recordId(RECORD_ID)
                .recordTitle("Breaking Bad")
                .recordType(RecordType.TV_SERIES.name())
                .kind(MediaRequestKind.NEW_FILES)
                .seasonNumber(season)
                .episodeNumber(episode)
                .status(MediaRequestStatus.PENDING)
                .voterUserIds(new HashSet<>(voters))
                .build();
        when(requestRepo.findByRecordIdAndKindAndSeasonNumberAndEpisodeNumber(
                RECORD_ID, MediaRequestKind.NEW_FILES, season, episode)).thenReturn(Optional.of(e));
        return e;
    }

    private MediaRequestEntity captureSaved() {
        ArgumentCaptor<MediaRequestEntity> captor = ArgumentCaptor.forClass(MediaRequestEntity.class);
        verify(requestRepo).save(captor.capture());
        return captor.getValue();
    }

    /* ── creation & scope persistence ───────────────────────────────────────── */

    @Test
    void aRequestWithNoScopeIsStoredAsWholeTitle() {
        givenRecord(RecordType.MOVIE);

        MediaRequestVoteResponse res =
                service.toggleVote(RECORD_ID, ME, MediaRequestKind.NEW_FILES, null, null);

        MediaRequestEntity saved = captureSaved();
        assertThat(saved.getSeasonNumber()).isEqualTo(MediaRequestScope.ALL);
        assertThat(saved.getEpisodeNumber()).isEqualTo(MediaRequestScope.ALL);
        assertThat(res.season()).isNull();
        assertThat(res.episode()).isNull();
        assertThat(res.scopeLabel()).isEqualTo("All");
        assertThat(res.voteCount()).isEqualTo(1);
        assertThat(res.hasMyVote()).isTrue();
    }

    @Test
    void aSeasonRequestIsStoredAgainstThatSeasonOnly() {
        givenRecord(RecordType.TV_SERIES);

        MediaRequestVoteResponse res =
                service.toggleVote(RECORD_ID, ME, MediaRequestKind.NEW_FILES, 2, null);

        MediaRequestEntity saved = captureSaved();
        assertThat(saved.getSeasonNumber()).isEqualTo(2);
        assertThat(saved.getEpisodeNumber()).isEqualTo(MediaRequestScope.ALL);
        assertThat(res.season()).isEqualTo(2);
        assertThat(res.episode()).isNull();
        assertThat(res.scopeLabel()).isEqualTo("Season 2");
    }

    @Test
    void anEpisodeRequestLooksUpItsOwnScopeAndNotTheWholeTitle() {
        givenRecord(RecordType.TV_SERIES);

        MediaRequestVoteResponse res =
                service.toggleVote(RECORD_ID, ME, MediaRequestKind.NEW_FILES, 2, 5);

        // The lookup is by scope, so an existing whole-title request cannot swallow the vote.
        verify(requestRepo).findByRecordIdAndKindAndSeasonNumberAndEpisodeNumber(
                RECORD_ID, MediaRequestKind.NEW_FILES, 2, 5);
        assertThat(captureSaved().getEpisodeNumber()).isEqualTo(5);
        assertThat(res.scopeLabel()).isEqualTo("S02E05");
    }

    @Test
    void specialsAreARealSeasonAndNotConfusedWithNoScope() {
        givenRecord(RecordType.TV_SERIES);

        service.toggleVote(RECORD_ID, ME, MediaRequestKind.NEW_FILES, 0, null);

        MediaRequestEntity saved = captureSaved();
        assertThat(saved.getSeasonNumber()).isZero();
        assertThat(saved.scope().isWholeTitle()).isFalse();
        assertThat(saved.scope().label()).isEqualTo("Specials");
    }

    @Test
    void aNewRequestTellsAdminsWhichPartWasAskedFor() {
        givenRecord(RecordType.TV_SERIES);

        service.toggleVote(RECORD_ID, ME, MediaRequestKind.NEW_FILES, 2, 5);

        ArgumentCaptor<String> body = ArgumentCaptor.forClass(String.class);
        verify(pushService).broadcastToAdmins(eq("New request"), body.capture(), any(), anyString());
        assertThat(body.getValue()).isEqualTo("Breaking Bad · S02E05 - new files");
    }

    /* ── rejected shapes ────────────────────────────────────────────────────── */

    @Test
    void anEpisodeWithoutASeasonIsRejectedBeforeAnythingIsWritten() {
        assertThatThrownBy(() -> service.toggleVote(RECORD_ID, ME, MediaRequestKind.NEW_FILES, null, 5))
                .isInstanceOf(DbWorldException.class);

        verify(requestRepo, never()).save(any());
    }

    @Test
    void aScopedRequestOnAMovieIsRejected() {
        givenRecord(RecordType.MOVIE);

        assertThatThrownBy(() -> service.toggleVote(RECORD_ID, ME, MediaRequestKind.NEW_FILES, 2, null))
                .isInstanceOf(DbWorldException.class)
                .satisfies(e -> assertThat(((DbWorldException) e).getHttpStatus()).isEqualTo(HttpStatus.BAD_REQUEST));

        verify(requestRepo, never()).save(any());
    }

    /* ── voting on an existing scoped request ───────────────────────────────── */

    @Test
    void aSecondVoterAggregatesOntoTheSameScope() {
        existing(2, 5, Set.of(SOMEONE_ELSE));

        MediaRequestVoteResponse res =
                service.toggleVote(RECORD_ID, ME, MediaRequestKind.NEW_FILES, 2, 5);

        assertThat(res.voteCount()).isEqualTo(2);
        assertThat(res.hasMyVote()).isTrue();
        verify(recordRepo, never()).findById(any());
    }

    @Test
    void withdrawingTheOnlyVotePrunesTheRequest() {
        MediaRequestEntity row = existing(2, 5, Set.of(ME));

        MediaRequestVoteResponse res =
                service.toggleVote(RECORD_ID, ME, MediaRequestKind.NEW_FILES, 2, 5);

        assertThat(res.voteCount()).isZero();
        assertThat(res.hasMyVote()).isFalse();
        verify(requestRepo).delete(row);
    }

    @Test
    void votingOnAFulfilledScopeReopensItWithACleanVoterSet() {
        MediaRequestEntity row = existing(2, 5, Set.of(SOMEONE_ELSE));
        row.setStatus(MediaRequestStatus.FULFILLED);

        MediaRequestVoteResponse res =
                service.toggleVote(RECORD_ID, ME, MediaRequestKind.NEW_FILES, 2, 5);

        assertThat(row.getStatus()).isEqualTo(MediaRequestStatus.PENDING);
        assertThat(row.getVoterUserIds()).containsExactly(ME);
        assertThat(res.voteCount()).isEqualTo(1);
    }

    /* ── what voters and admins are told ───────────────────────────────────── */

    @Test
    void fulfillingAnEpisodeRequestNamesTheEpisodeInTheNotification() {
        MediaRequestEntity row = existing(2, 5, Set.of(ME, SOMEONE_ELSE));
        when(requestRepo.findById(1L)).thenReturn(Optional.of(row));

        service.fulfill(1L, 99L, "admin");

        verify(notifService).createRequestFulfilledNotifications(
                eq(99L), eq("admin"), eq(RECORD_ID), eq("Breaking Bad · S02E05"),
                eq(RecordType.TV_SERIES.name()), anyCollection());
    }

    @Test
    void theDeepLinkSlugStaysFreeOfTheScopeLabel() {
        MediaRequestEntity row = existing(2, 5, Set.of(ME));
        when(requestRepo.findById(1L)).thenReturn(Optional.of(row));

        service.fulfill(1L, 99L, "admin");

        @SuppressWarnings("unchecked")
        ArgumentCaptor<java.util.Map<String, String>> data = ArgumentCaptor.forClass(java.util.Map.class);
        verify(pushService).sendToUsers(anyCollection(), eq("Request fulfilled"),
                eq("Breaking Bad · S02E05"), data.capture(), anyString());
        assertThat(data.getValue().get("link")).isEqualTo("/db-world/db-cinema/series/42-breaking-bad");
    }

    @Test
    void dismissingAWholeTitleRequestLeavesTheTitleUnqualified() {
        MediaRequestEntity row = existing(MediaRequestScope.ALL, MediaRequestScope.ALL, Set.of(ME));
        when(requestRepo.findById(1L)).thenReturn(Optional.of(row));

        service.dismiss(1L, "  not out yet  ", 99L, "admin");

        verify(notifService).createRequestDismissedNotifications(
                eq(99L), eq("admin"), eq(RECORD_ID), eq("Breaking Bad"),
                eq(RecordType.TV_SERIES.name()), eq("not out yet"), anyCollection());
    }

    /* ── read models ───────────────────────────────────────────────────────── */

    @Test
    void theRecordSummaryCarriesScopeCountsAndWhetherIVoted() {
        MediaRequestEntity wholeTitle = MediaRequestEntity.builder()
                .id(1L).recordId(RECORD_ID).recordTitle("Breaking Bad")
                .recordType(RecordType.TV_SERIES.name()).kind(MediaRequestKind.NEW_FILES)
                .status(MediaRequestStatus.PENDING)
                .voterUserIds(new HashSet<>(Set.of(SOMEONE_ELSE)))
                .build();
        MediaRequestEntity episode = MediaRequestEntity.builder()
                .id(2L).recordId(RECORD_ID).recordTitle("Breaking Bad")
                .recordType(RecordType.TV_SERIES.name()).kind(MediaRequestKind.NEW_FILES)
                .seasonNumber(2).episodeNumber(5)
                .status(MediaRequestStatus.PENDING)
                .voterUserIds(new HashSet<>(Set.of(ME, SOMEONE_ELSE)))
                .build();
        when(requestRepo.findPendingForRecordWithVoters(RECORD_ID)).thenReturn(List.of(wholeTitle, episode));

        List<MediaRequestScopeSummary> summaries = service.listPendingForRecord(RECORD_ID, ME);

        assertThat(summaries).hasSize(2);
        assertThat(summaries.getFirst().season()).isNull();
        assertThat(summaries.getFirst().voteCount()).isEqualTo(1);
        assertThat(summaries.getFirst().hasMyVote()).isFalse();
        assertThat(summaries.getLast().season()).isEqualTo(2);
        assertThat(summaries.getLast().episode()).isEqualTo(5);
        assertThat(summaries.getLast().scopeLabel()).isEqualTo("S02E05");
        assertThat(summaries.getLast().hasMyVote()).isTrue();
    }

    @Test
    void myPendingRequestsReportNullScopeForAWholeTitleAsk() {
        MediaRequestEntity wholeTitle = MediaRequestEntity.builder()
                .id(1L).recordId(RECORD_ID).recordTitle("Breaking Bad")
                .recordType(RecordType.MOVIE.name()).kind(MediaRequestKind.NEW_FILES)
                .status(MediaRequestStatus.PENDING).build();
        MediaRequestEntity season = MediaRequestEntity.builder()
                .id(2L).recordId(RECORD_ID).recordTitle("Breaking Bad")
                .recordType(RecordType.TV_SERIES.name()).kind(MediaRequestKind.NEW_FILES)
                .seasonNumber(3).status(MediaRequestStatus.PENDING).build();
        when(requestRepo.findPendingVotedBy(ME)).thenReturn(List.of(wholeTitle, season));

        List<MyMediaRequestEntry> mine = service.getMyPendingRequests(ME);

        assertThat(mine.getFirst().season()).isNull();
        assertThat(mine.getFirst().episode()).isNull();
        assertThat(mine.getLast().season()).isEqualTo(3);
        assertThat(mine.getLast().episode()).isNull();
    }
}
