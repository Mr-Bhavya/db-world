package com.db.dbworld.app.cinema.progress.service;

import com.db.dbworld.app.cinema.progress.entity.WatchProgressEntity;
import com.db.dbworld.app.cinema.progress.repository.WatchProgressRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

/**
 * Record-scoped progress lookup. The player's episode list draws a watched bar per episode;
 * before this existed the only options were one request per episode or pulling the user's
 * entire watch history and filtering it client-side.
 */
@ExtendWith(MockitoExtension.class)
class WatchProgressRecordScopeTest {

    private static final Long USER = 7L;
    private static final Long RECORD = 42L;

    @Mock WatchProgressRepository repository;
    @InjectMocks WatchProgressService service;

    private static WatchProgressEntity progress(String fileId, long positionMs, long durationMs) {
        return WatchProgressEntity.builder()
                .userId(USER).recordId(RECORD).fileId(fileId)
                .positionMs(positionMs).durationMs(durationMs)
                .updatedAt(Instant.now())
                .build();
    }

    @Test
    void returnsEveryFileOfTheRecord() {
        when(repository.findByUserIdAndRecordId(USER, RECORD)).thenReturn(List.of(
                progress("ep1", 600_000L, 2_400_000L),
                progress("ep2", 2_350_000L, 2_400_000L)));

        List<WatchProgressService.ProgressDto> dtos = service.getRecordProgress(USER, RECORD);

        assertThat(dtos).extracting(WatchProgressService.ProgressDto::getFileId)
                .containsExactly("ep1", "ep2");
        assertThat(dtos).extracting(WatchProgressService.ProgressDto::getPositionMs)
                .containsExactly(600_000L, 2_350_000L);
    }

    @Test
    void carriesDurationSoTheClientCanComputeAPercentage() {
        when(repository.findByUserIdAndRecordId(USER, RECORD))
                .thenReturn(List.of(progress("ep1", 600_000L, 2_400_000L)));

        WatchProgressService.ProgressDto dto = service.getRecordProgress(USER, RECORD).getFirst();

        assertThat(dto.getDurationMs()).isEqualTo(2_400_000L);
        assertThat(dto.getRecordId()).isEqualTo(RECORD);
    }

    @Test
    void isEmptyForARecordTheUserHasNeverStarted() {
        when(repository.findByUserIdAndRecordId(USER, RECORD)).thenReturn(List.of());

        assertThat(service.getRecordProgress(USER, RECORD)).isEmpty();
    }
}
