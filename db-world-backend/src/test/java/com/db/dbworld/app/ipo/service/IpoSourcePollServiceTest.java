package com.db.dbworld.app.ipo.service;

import com.db.dbworld.app.ipo.entity.IpoSourcePollEntity;
import com.db.dbworld.app.ipo.repository.IpoSourcePollRepository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class IpoSourcePollServiceTest {

    private static final Instant NOW = Instant.parse("2026-07-24T12:00:00Z");
    private static final Instant EARLIER = Instant.parse("2026-07-24T09:00:00Z");

    @Mock
    IpoSourcePollRepository repository;

    private IpoSourcePollService service;

    @BeforeEach
    void setUp() {
        service = new IpoSourcePollService(repository);
    }

    @Test
    void recordSuccess_noExistingRow_createsRowWithOkStatusAndZeroFailures() {
        when(repository.findById("ipoguru")).thenReturn(Optional.empty());

        service.recordSuccess("ipoguru", NOW);

        ArgumentCaptor<IpoSourcePollEntity> captor = ArgumentCaptor.forClass(IpoSourcePollEntity.class);
        verify(repository).save(captor.capture());
        IpoSourcePollEntity saved = captor.getValue();
        assertThat(saved.getSource()).isEqualTo("ipoguru");
        assertThat(saved.getLastPolledAt()).isEqualTo(NOW);
        assertThat(saved.getLastSuccessAt()).isEqualTo(NOW);
        assertThat(saved.getLastStatus()).isEqualTo("OK");
        assertThat(saved.getConsecutiveFailures()).isZero();
    }

    @Test
    void recordSuccess_existingRowWithFailures_resetsFailuresAndSetsBothTimestamps() {
        IpoSourcePollEntity existing = IpoSourcePollEntity.builder()
                .source("nse")
                .lastPolledAt(EARLIER)
                .lastSuccessAt(EARLIER)
                .lastStatus("FAILED")
                .consecutiveFailures(4)
                .build();
        when(repository.findById("nse")).thenReturn(Optional.of(existing));

        service.recordSuccess("nse", NOW);

        ArgumentCaptor<IpoSourcePollEntity> captor = ArgumentCaptor.forClass(IpoSourcePollEntity.class);
        verify(repository).save(captor.capture());
        IpoSourcePollEntity saved = captor.getValue();
        assertThat(saved.getLastPolledAt()).isEqualTo(NOW);
        assertThat(saved.getLastSuccessAt()).isEqualTo(NOW);
        assertThat(saved.getLastStatus()).isEqualTo("OK");
        assertThat(saved.getConsecutiveFailures()).isZero();
    }

    @Test
    void recordFailure_noExistingRow_createsRowWithStatusAndOneFailure() {
        when(repository.findById("chittorgarh")).thenReturn(Optional.empty());

        service.recordFailure("chittorgarh", NOW, "FAILED");

        ArgumentCaptor<IpoSourcePollEntity> captor = ArgumentCaptor.forClass(IpoSourcePollEntity.class);
        verify(repository).save(captor.capture());
        IpoSourcePollEntity saved = captor.getValue();
        assertThat(saved.getSource()).isEqualTo("chittorgarh");
        assertThat(saved.getLastPolledAt()).isEqualTo(NOW);
        assertThat(saved.getLastSuccessAt()).isNull();
        assertThat(saved.getLastStatus()).isEqualTo("FAILED");
        assertThat(saved.getConsecutiveFailures()).isEqualTo(1);
    }

    @Test
    void recordFailure_existingRow_incrementsFailuresAndPreservesLastSuccessAt() {
        IpoSourcePollEntity existing = IpoSourcePollEntity.builder()
                .source("nse")
                .lastPolledAt(EARLIER)
                .lastSuccessAt(EARLIER)
                .lastStatus("OK")
                .consecutiveFailures(2)
                .build();
        when(repository.findById("nse")).thenReturn(Optional.of(existing));

        service.recordFailure("nse", NOW, "EMPTY");

        ArgumentCaptor<IpoSourcePollEntity> captor = ArgumentCaptor.forClass(IpoSourcePollEntity.class);
        verify(repository).save(captor.capture());
        IpoSourcePollEntity saved = captor.getValue();
        assertThat(saved.getLastPolledAt()).isEqualTo(NOW);
        assertThat(saved.getLastSuccessAt()).isEqualTo(EARLIER); // untouched
        assertThat(saved.getLastStatus()).isEqualTo("EMPTY");
        assertThat(saved.getConsecutiveFailures()).isEqualTo(3);
    }

    @Test
    void lastSuccessAcrossSources_returnsMaxAcrossRows() {
        IpoSourcePollEntity a = IpoSourcePollEntity.builder().source("a").lastSuccessAt(EARLIER).build();
        IpoSourcePollEntity b = IpoSourcePollEntity.builder().source("b").lastSuccessAt(NOW).build();
        when(repository.findAll()).thenReturn(List.of(a, b));

        Optional<Instant> result = service.lastSuccessAcrossSources();

        assertThat(result).contains(NOW);
    }

    @Test
    void lastSuccessAcrossSources_rowsWithNullLastSuccessAt_areIgnored() {
        IpoSourcePollEntity neverSucceeded = IpoSourcePollEntity.builder().source("a").lastSuccessAt(null).build();
        when(repository.findAll()).thenReturn(List.of(neverSucceeded));

        Optional<Instant> result = service.lastSuccessAcrossSources();

        assertThat(result).isEmpty();
    }

    @Test
    void lastSuccessAcrossSources_noRows_returnsEmpty() {
        when(repository.findAll()).thenReturn(List.of());

        assertThat(service.lastSuccessAcrossSources()).isEmpty();
        verify(repository, never()).save(org.mockito.ArgumentMatchers.any());
    }
}
