package com.db.dbworld.app.ipo.service;

import com.db.dbworld.app.ipo.dto.IpoApplicationDto;
import com.db.dbworld.app.ipo.dto.MyIpoDto;
import com.db.dbworld.app.ipo.dto.SaveApplicationRequest;
import com.db.dbworld.app.ipo.entity.IpoListingEntity;
import com.db.dbworld.app.ipo.entity.IpoUserApplicationEntity;
import com.db.dbworld.app.ipo.mapper.IpoMapper;
import com.db.dbworld.app.ipo.repository.IpoListingRepository;
import com.db.dbworld.app.ipo.repository.IpoUserApplicationRepository;
import com.db.dbworld.core.exception.DbWorldException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class IpoApplicationServiceTest {

    private static final Long USER_ID = 42L;
    private static final Long OTHER_USER_ID = 99L;
    private static final String IPO_ID = "ipo-1";

    IpoUserApplicationRepository applicationRepository;
    IpoListingRepository listingRepository;
    IpoApplicationService service;

    @BeforeEach
    void setUp() {
        applicationRepository = mock(IpoUserApplicationRepository.class);
        listingRepository = mock(IpoListingRepository.class);
        service = new IpoApplicationService(applicationRepository, listingRepository, new IpoMapper());
    }

    private SaveApplicationRequest request(String pan) {
        return new SaveApplicationRequest("Jane Doe", "APP123", "DP456", pan, "unknown");
    }

    @Test
    void upsert_fullPan_storesOnlyLastFourCharacters() {
        when(listingRepository.existsById(IPO_ID)).thenReturn(true);
        when(applicationRepository.findByUserIdAndIpoId(USER_ID, IPO_ID)).thenReturn(Optional.empty());
        when(applicationRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        IpoApplicationDto result = service.upsert(USER_ID, IPO_ID, request("ABCDE1234F"));

        assertThat(result.panLast4()).isEqualTo("234F");

        ArgumentCaptor<IpoUserApplicationEntity> captor = ArgumentCaptor.forClass(IpoUserApplicationEntity.class);
        verify(applicationRepository).save(captor.capture());
        IpoUserApplicationEntity saved = captor.getValue();
        assertThat(saved.getPanLast4()).isEqualTo("234F");
        assertThat(saved.getPanLast4()).hasSize(4); // never the full 10-char PAN
        assertThat(saved.getUserId()).isEqualTo(USER_ID);
        assertThat(saved.getIpoId()).isEqualTo(IPO_ID);
        assertThat(saved.getApplicantName()).isEqualTo("Jane Doe");
        assertThat(saved.getApplicationNo()).isEqualTo("APP123");
        assertThat(saved.getDpClientId()).isEqualTo("DP456");
    }

    @Test
    void upsert_noPanSupplied_preservesExistingPanLast4() {
        when(listingRepository.existsById(IPO_ID)).thenReturn(true);
        IpoUserApplicationEntity existing = IpoUserApplicationEntity.builder()
                .id("app-1").userId(USER_ID).ipoId(IPO_ID).panLast4("9999").build();
        when(applicationRepository.findByUserIdAndIpoId(USER_ID, IPO_ID)).thenReturn(Optional.of(existing));
        when(applicationRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        IpoApplicationDto result = service.upsert(USER_ID, IPO_ID, request(null));

        assertThat(result.panLast4()).isEqualTo("9999");
    }

    @Test
    void upsert_blankPanSupplied_preservesExistingPanLast4() {
        when(listingRepository.existsById(IPO_ID)).thenReturn(true);
        IpoUserApplicationEntity existing = IpoUserApplicationEntity.builder()
                .id("app-1").userId(USER_ID).ipoId(IPO_ID).panLast4("9999").build();
        when(applicationRepository.findByUserIdAndIpoId(USER_ID, IPO_ID)).thenReturn(Optional.of(existing));
        when(applicationRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        IpoApplicationDto result = service.upsert(USER_ID, IPO_ID, request("   "));

        assertThat(result.panLast4()).isEqualTo("9999");
    }

    @Test
    void upsert_ipoDoesNotExist_throwsNotFound() {
        when(listingRepository.existsById(IPO_ID)).thenReturn(false);

        assertThatThrownBy(() -> service.upsert(USER_ID, IPO_ID, request("ABCDE1234F")))
                .isInstanceOf(DbWorldException.class)
                .satisfies(ex -> assertThat(((DbWorldException) ex).getHttpStatus())
                        .isEqualTo(org.springframework.http.HttpStatus.NOT_FOUND));

        verify(applicationRepository, never()).save(any());
    }

    @Test
    void upsert_looksUpExistingRowScopedToThisUserOnly() {
        // (userId, ipoId) uniqueness means another user's row for this ipo must never be read/updated here.
        when(listingRepository.existsById(IPO_ID)).thenReturn(true);
        when(applicationRepository.findByUserIdAndIpoId(USER_ID, IPO_ID)).thenReturn(Optional.empty());
        when(applicationRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.upsert(USER_ID, IPO_ID, request("ABCDE1234F"));

        verify(applicationRepository).findByUserIdAndIpoId(USER_ID, IPO_ID);
        verify(applicationRepository, never()).findByUserIdAndIpoId(OTHER_USER_ID, IPO_ID);
    }

    @Test
    void getMine_delegatesWithUserScoping() {
        IpoUserApplicationEntity entity = IpoUserApplicationEntity.builder()
                .userId(USER_ID).ipoId(IPO_ID).applicantName("Jane Doe").build();
        when(applicationRepository.findByUserIdAndIpoId(USER_ID, IPO_ID)).thenReturn(Optional.of(entity));

        Optional<IpoApplicationDto> result = service.getMine(USER_ID, IPO_ID);

        assertThat(result).isPresent();
        assertThat(result.get().applicantName()).isEqualTo("Jane Doe");
        verify(applicationRepository, never()).findByUserIdAndIpoId(OTHER_USER_ID, IPO_ID);
    }

    @Test
    void getMine_none_returnsEmptyOptional() {
        when(applicationRepository.findByUserIdAndIpoId(USER_ID, IPO_ID)).thenReturn(Optional.empty());

        assertThat(service.getMine(USER_ID, IPO_ID)).isEmpty();
    }

    @Test
    void listMine_joinsEachApplicationWithItsIpoSummary() {
        IpoUserApplicationEntity app1 = IpoUserApplicationEntity.builder()
                .userId(USER_ID).ipoId("ipo-1").applicantName("Jane Doe").build();
        IpoUserApplicationEntity app2 = IpoUserApplicationEntity.builder()
                .userId(USER_ID).ipoId("ipo-2").applicantName("Jane Doe").build();
        when(applicationRepository.findByUserId(USER_ID)).thenReturn(List.of(app1, app2));
        when(listingRepository.findById("ipo-1")).thenReturn(Optional.of(
                IpoListingEntity.builder().id("ipo-1").companyName("Acme Corp").build()));
        when(listingRepository.findById("ipo-2")).thenReturn(Optional.of(
                IpoListingEntity.builder().id("ipo-2").companyName("Widget Ltd").build()));

        List<MyIpoDto> result = service.listMine(USER_ID);

        assertThat(result).hasSize(2);
        assertThat(result).extracting(m -> m.ipo().companyName())
                .containsExactlyInAnyOrder("Acme Corp", "Widget Ltd");
    }

    @Test
    void listMine_orphanedIpoId_isSkippedGracefully() {
        IpoUserApplicationEntity orphan = IpoUserApplicationEntity.builder()
                .userId(USER_ID).ipoId("deleted-ipo").applicantName("Jane Doe").build();
        IpoUserApplicationEntity valid = IpoUserApplicationEntity.builder()
                .userId(USER_ID).ipoId("ipo-1").applicantName("Jane Doe").build();
        when(applicationRepository.findByUserId(USER_ID)).thenReturn(List.of(orphan, valid));
        when(listingRepository.findById("deleted-ipo")).thenReturn(Optional.empty());
        when(listingRepository.findById("ipo-1")).thenReturn(Optional.of(
                IpoListingEntity.builder().id("ipo-1").companyName("Acme Corp").build()));

        List<MyIpoDto> result = service.listMine(USER_ID);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).ipo().companyName()).isEqualTo("Acme Corp");
    }

    @Test
    void listMine_none_returnsEmptyList() {
        when(applicationRepository.findByUserId(USER_ID)).thenReturn(List.of());

        assertThat(service.listMine(USER_ID)).isEmpty();
    }

    @Test
    void delete_scopedToUser() {
        service.delete(USER_ID, IPO_ID);

        verify(applicationRepository).deleteByUserIdAndIpoId(USER_ID, IPO_ID);
        verify(applicationRepository, never()).deleteByUserIdAndIpoId(OTHER_USER_ID, IPO_ID);
    }
}
