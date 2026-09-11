package com.db.dbworld.app.ipo.service;

import com.db.dbworld.app.ipo.entity.IpoChangeEventEntity;
import com.db.dbworld.app.ipo.entity.IpoListingEntity;
import com.db.dbworld.app.ipo.repository.IpoChangeEventRepository;
import com.db.dbworld.app.ipo.repository.IpoListingRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The status sweep — what stops an IPO reading "Upcoming" for hours after bidding actually opened.
 *
 * <p>All times are chosen against the IST calendar: the fixed clocks below are UTC instants, and
 * 10&nbsp;AM IST is 04:30&nbsp;UTC, 5&nbsp;PM IST is 11:30&nbsp;UTC.
 */
@ExtendWith(MockitoExtension.class)
class IpoStatusSweepServiceTest {

    @Mock IpoListingRepository listingRepo;
    @Mock IpoChangeEventRepository changeEventRepo;

    private static final LocalDate OPEN_DAY = LocalDate.of(2026, 9, 10);
    private static final LocalDate CLOSE_DAY = LocalDate.of(2026, 9, 12);

    /** 11:00 AM IST on the open day — bidding has started. */
    private static final Instant MID_MORNING_IST = Instant.parse("2026-09-10T05:30:00Z");
    /** 9:00 AM IST on the open day — bidding has NOT started. */
    private static final Instant EARLY_IST = Instant.parse("2026-09-10T03:30:00Z");
    /** 6:00 PM IST on the close day — bidding is over. */
    private static final Instant EVENING_CLOSE_DAY = Instant.parse("2026-09-12T12:30:00Z");

    private IpoStatusSweepService serviceAt(Instant now) {
        return new IpoStatusSweepService(listingRepo, changeEventRepo, Clock.fixed(now, ZoneOffset.UTC));
    }

    private static IpoListingEntity ipo(String id, String status, LocalDate open, LocalDate close) {
        return IpoListingEntity.builder()
                .id(id).companyName("Company " + id).status(status).openDate(open).closeDate(close).build();
    }

    @Test
    void sweep_openDayPastTenAmIst_promotesUpcomingWithoutWaitingForAPoll() {
        // THE bug. The poll is expensive so it runs every couple of hours; bidding opens at 10 AM
        // regardless, and until now nothing recomputed the status in between — production flipped
        // five IPOs to open in the 12:00 pass on their own open day, two hours late.
        IpoListingEntity ipo = ipo("1", "upcoming", OPEN_DAY, CLOSE_DAY);
        when(listingRepo.findAllLive()).thenReturn(List.of(ipo));

        assertThat(serviceAt(MID_MORNING_IST).sweep()).isEqualTo(1);
        assertThat(ipo.getStatus()).isEqualTo("open");
        verify(listingRepo).saveAll(List.of(ipo));
    }

    @Test
    void sweep_promotion_writesTheStatusEventThatDrivesTheOpenPush() {
        // The push rides the change-event queue, so a swept transition has to look exactly like a
        // polled one or the alert would still wait for the next poll.
        IpoListingEntity ipo = ipo("1", "upcoming", OPEN_DAY, CLOSE_DAY);
        when(listingRepo.findAllLive()).thenReturn(List.of(ipo));

        serviceAt(MID_MORNING_IST).sweep();

        ArgumentCaptor<List<IpoChangeEventEntity>> captor = ArgumentCaptor.captor();
        verify(changeEventRepo).saveAll(captor.capture());
        assertThat(captor.getValue()).singleElement().satisfies(e -> {
            assertThat(e.getEventType()).isEqualTo("STATUS");
            assertThat(e.getOldValue()).isEqualTo("upcoming");
            assertThat(e.getNewValue()).isEqualTo("open");
            assertThat(e.getIpoId()).isEqualTo("1");
            assertThat(e.getNotifiedAt()).isNull();   // still pending, so the drain picks it up
        });
    }

    @Test
    void sweep_beforeTenAmIstOnTheOpenDay_leavesItUpcoming() {
        // The sweep must not run ahead of the calendar, or a 9 AM tick fires "IPO is open" an hour
        // before anyone can bid.
        IpoListingEntity ipo = ipo("1", "upcoming", OPEN_DAY, CLOSE_DAY);
        when(listingRepo.findAllLive()).thenReturn(List.of(ipo));

        assertThat(serviceAt(EARLY_IST).sweep()).isZero();
        assertThat(ipo.getStatus()).isEqualTo("upcoming");
        verify(listingRepo, never()).saveAll(any());
    }

    @Test
    void sweep_noCloseDateAnnounced_stillPromotesOnTheOpenDate() {
        // The rule this replaced demanded BOTH dates, while the date-only derivation was happy to
        // call the same issue open. A missing close date is not evidence that bidding hasn't
        // started, and requiring one left a stale "upcoming" uncorrected indefinitely.
        IpoListingEntity ipo = ipo("1", "upcoming", OPEN_DAY, null);
        when(listingRepo.findAllLive()).thenReturn(List.of(ipo));

        assertThat(serviceAt(MID_MORNING_IST).sweep()).isEqualTo(1);
        assertThat(ipo.getStatus()).isEqualTo("open");
    }

    @Test
    void sweep_pastFivePmOnTheCloseDay_downgradesOpenToClosed() {
        IpoListingEntity ipo = ipo("1", "open", OPEN_DAY, CLOSE_DAY);
        when(listingRepo.findAllLive()).thenReturn(List.of(ipo));

        assertThat(serviceAt(EVENING_CLOSE_DAY).sweep()).isEqualTo(1);
        assertThat(ipo.getStatus()).isEqualTo("closed");
    }

    @Test
    void sweep_wholeWindowAlreadyPassed_goesStraightToClosed() {
        // Unsticks an IPO a source stopped reporting entirely — NSE drops an issue once it is no
        // longer current, so nothing else would ever re-derive its status.
        IpoListingEntity ipo = ipo("1", "upcoming", LocalDate.of(2026, 8, 1), LocalDate.of(2026, 8, 5));
        when(listingRepo.findAllLive()).thenReturn(List.of(ipo));

        assertThat(serviceAt(MID_MORNING_IST).sweep()).isEqualTo(1);
        assertThat(ipo.getStatus()).isEqualTo("closed");
    }

    @Test
    void sweep_listedIpo_isNeverTouched() {
        // A listing date is a forecast until the shares actually trade, so the calendar may not
        // promote to "listed" — and must certainly not demote something already there.
        IpoListingEntity listed = ipo("1", "listed", OPEN_DAY, CLOSE_DAY);
        IpoListingEntity closed = ipo("2", "closed", OPEN_DAY, CLOSE_DAY);
        when(listingRepo.findAllLive()).thenReturn(List.of(listed, closed));

        assertThat(serviceAt(EVENING_CLOSE_DAY).sweep()).isZero();
        assertThat(listed.getStatus()).isEqualTo("listed");
        assertThat(closed.getStatus()).isEqualTo("closed");
    }

    @Test
    void sweep_nothingMoved_writesNothingAtAll() {
        when(listingRepo.findAllLive()).thenReturn(List.of(ipo("1", "open", OPEN_DAY, CLOSE_DAY)));

        assertThat(serviceAt(MID_MORNING_IST).sweep()).isZero();
        verify(listingRepo, never()).saveAll(any());
        verify(changeEventRepo, never()).saveAll(any());
    }

    @Test
    void sweep_repositoryBlowsUp_isSwallowedSoTheLiveRefreshStillRuns() {
        when(listingRepo.findAllLive()).thenThrow(new RuntimeException("db down"));

        assertThat(serviceAt(MID_MORNING_IST).sweepQuietly()).isZero();
    }
}
