package com.db.dbworld.app.ipo.service;

import com.db.dbworld.app.ipo.dto.IpoDuplicateDto;
import com.db.dbworld.app.ipo.entity.IpoListingEntity;
import com.db.dbworld.app.ipo.repository.IpoChangeEventRepository;
import com.db.dbworld.app.ipo.repository.IpoFinancialRepository;
import com.db.dbworld.app.ipo.repository.IpoGmpHistoryRepository;
import com.db.dbworld.app.ipo.repository.IpoListingRepository;
import com.db.dbworld.app.ipo.repository.IpoSubscriptionHistoryRepository;
import com.db.dbworld.app.ipo.repository.IpoUserApplicationRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The duplicate report and merge — the review-then-apply half of the de-duplication work.
 *
 * <p>{@link Strictness#LENIENT} because a merge fans out across six repositories and most tests
 * only assert on one or two of them; the alternative is every test restating the whole cascade.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class IpoDuplicateServiceTest {

    @Mock IpoListingRepository listingRepo;
    @Mock IpoGmpHistoryRepository gmpHistoryRepo;
    @Mock IpoSubscriptionHistoryRepository subHistoryRepo;
    @Mock IpoFinancialRepository financialRepo;
    @Mock IpoChangeEventRepository changeEventRepo;
    @Mock IpoUserApplicationRepository userApplicationRepo;

    private IpoDuplicateService service() {
        return new IpoDuplicateService(listingRepo, gmpHistoryRepo, subHistoryRepo, financialRepo,
                changeEventRepo, userApplicationRepo);
    }

    private static final Instant T0 = Instant.parse("2026-09-01T00:00:00Z");

    /** One of the two real duplicate pairs from the production list. */
    private static IpoListingEntity row(String id, String name, String matchKey, Instant firstSeen) {
        return IpoListingEntity.builder()
                .id(id).companyName(name).matchKey(matchKey).aliasKey("assetreconstructioncompanyindia")
                .openDate(LocalDate.of(2026, 9, 9)).firstSeenAt(firstSeen).lastSeenAt(firstSeen)
                .build();
    }

    @Test
    void report_groupsTheClusterAndPicksTheInvestorgainMatchedRowAsSurvivor() {
        // The row carrying investorgainId is the one every future poll can look up by id, so
        // merging INTO it is what keeps GMP flowing to the surviving listing.
        IpoListingEntity withGmp = row("ipo-a", "Asset Reconstruction Co.(India) Ltd.",
                "asset reconstruction coindia|2026-09-09", T0.plusSeconds(60));
        withGmp.setInvestorgainId(1234);
        withGmp.setGmp(new BigDecimal("24"));
        IpoListingEntity bare = row("ipo-b", "Asset Reconstruction Company (India) Limited",
                "asset reconstruction company india|2026-09-09", T0);   // older, but empty

        when(listingRepo.findDuplicateAliasKeys()).thenReturn(List.of("assetreconstructioncompanyindia"));
        when(listingRepo.findLiveByAliasKey("assetreconstructioncompanyindia")).thenReturn(List.of(bare, withGmp));
        when(gmpHistoryRepo.countByIpoId(anyString())).thenReturn(0L);
        when(userApplicationRepo.countByIpoId(anyString())).thenReturn(0L);

        List<IpoDuplicateDto.Cluster> clusters = service().report();

        assertThat(clusters).hasSize(1);
        assertThat(clusters.get(0).survivor().id()).isEqualTo("ipo-a");
        assertThat(clusters.get(0).losers()).extracting(IpoDuplicateDto.Row::id).containsExactly("ipo-b");
        assertThat(clusters.get(0).size()).isEqualTo(2);
        // Read-only: a dry run must not touch anything.
        verify(listingRepo, never()).save(any());
    }

    @Test
    void report_survivorPrefersTheRowHoldingMoreUserApplications() {
        // Every application on a loser has to be moved, so keeping the busiest row touches the
        // least real user data.
        IpoListingEntity quiet = row("ipo-a", "Acme Ltd", "acme|2026-09-09", T0);
        IpoListingEntity busy = row("ipo-b", "Acme Limited", "acmex|2026-09-09", T0.plusSeconds(60));

        when(listingRepo.findDuplicateAliasKeys()).thenReturn(List.of("assetreconstructioncompanyindia"));
        when(listingRepo.findLiveByAliasKey(anyString())).thenReturn(List.of(quiet, busy));
        when(gmpHistoryRepo.countByIpoId(anyString())).thenReturn(0L);
        when(userApplicationRepo.countByIpoId("ipo-a")).thenReturn(0L);
        when(userApplicationRepo.countByIpoId("ipo-b")).thenReturn(4L);

        assertThat(service().report().get(0).survivor().id()).isEqualTo("ipo-b");
    }

    @Test
    void merge_repointsEveryChildTableAndTombstonesTheLoser() {
        IpoListingEntity survivor = row("ipo-a", "Acme Ltd", "acme|2026-09-09", T0);
        survivor.setInvestorgainId(1234);
        IpoListingEntity loser = row("ipo-b", "Acme Limited", "acmex|2026-09-09", T0.plusSeconds(60));

        when(listingRepo.findDuplicateAliasKeys()).thenReturn(List.of("acme"));
        when(listingRepo.findLiveByAliasKey("acme")).thenReturn(List.of(survivor, loser));
        when(userApplicationRepo.repointToSurvivor("ipo-a", "ipo-b")).thenReturn(2);

        IpoDuplicateDto.MergeResult result = service().mergeAll();

        verify(gmpHistoryRepo).repointToSurvivor("ipo-a", "ipo-b");
        verify(subHistoryRepo).repointToSurvivor("ipo-a", "ipo-b");
        verify(financialRepo).repointToSurvivor("ipo-a", "ipo-b");
        verify(changeEventRepo).repointToSurvivor("ipo-a", "ipo-b");
        // Tombstoned, not deleted, so the merge can be undone by clearing one column.
        assertThat(loser.getMergedIntoId()).isEqualTo("ipo-a");
        verify(listingRepo, never()).delete(any());
        verify(listingRepo, never()).deleteById(anyString());
        assertThat(result.clustersMerged()).isEqualTo(1);
        assertThat(result.rowsMerged()).isEqualTo(1);
        assertThat(result.applicationsMoved()).isEqualTo(2);
    }

    @Test
    void merge_dropsCollidingApplicationsBeforeRepointingThem() {
        // (user_id, ipo_id) is UNIQUE, so a user who tracked BOTH halves would make the repoint
        // throw. Their duplicate row is dropped first and they lose nothing - they already hold an
        // application against the survivor.
        IpoListingEntity survivor = row("ipo-a", "Acme Ltd", "acme|2026-09-09", T0);
        IpoListingEntity loser = row("ipo-b", "Acme Limited", "acmex|2026-09-09", T0.plusSeconds(60));
        when(listingRepo.findDuplicateAliasKeys()).thenReturn(List.of("acme"));
        when(listingRepo.findLiveByAliasKey("acme")).thenReturn(List.of(survivor, loser));
        when(userApplicationRepo.findCollidingIdsForMerge("ipo-a", "ipo-b")).thenReturn(List.of("app-1"));

        IpoDuplicateDto.MergeResult result = service().mergeAll();

        org.mockito.InOrder inOrder = org.mockito.Mockito.inOrder(userApplicationRepo);
        inOrder.verify(userApplicationRepo).findCollidingIdsForMerge("ipo-a", "ipo-b");
        inOrder.verify(userApplicationRepo).deleteAllById(List.of("app-1"));
        inOrder.verify(userApplicationRepo).repointToSurvivor("ipo-a", "ipo-b");
        assertThat(result.applicationsDroppedAsDuplicate()).isEqualTo(1);
    }

    @Test
    void merge_survivorAdoptsTheFieldsItWasMissingAndKeepsTheOnesItHad() {
        // This is what actually fixes the user-visible symptom: the two halves hold complementary
        // fragments - one matched investorgain and carries the GMP, the other was ingested from NSE
        // and carries the price band - so a merge that only repointed history would throw half of
        // the data away and still leave a card looking empty.
        // Exactly the production shape: the investorgain-matched half won the survivor vote and
        // carries the GMP; the NSE-ingested half carries the price band and lot size.
        IpoListingEntity survivor = row("ipo-a", "Acme Ltd", "acme|2026-09-09", T0);
        survivor.setInvestorgainId(1234);
        survivor.setGmp(new BigDecimal("24"));
        IpoListingEntity loser = row("ipo-b", "Acme Limited", "acmex|2026-09-09", T0.plusSeconds(60));
        loser.setGmp(new BigDecimal("99"));            // must NOT overwrite the survivor's
        loser.setInvestorgainId(4321);                 // nor its investorgain id
        loser.setPriceMin(new BigDecimal("132"));      // survivor has none, so these fill in
        loser.setPriceMax(new BigDecimal("139"));
        loser.setLotSize(107);
        loser.setRegistrar("Link Intime");

        when(listingRepo.findDuplicateAliasKeys()).thenReturn(List.of("acme"));
        when(listingRepo.findLiveByAliasKey("acme")).thenReturn(List.of(survivor, loser));

        service().mergeAll();

        assertThat(survivor.getGmp()).isEqualByComparingTo("24");   // untouched
        assertThat(survivor.getInvestorgainId()).isEqualTo(1234);   // untouched
        assertThat(survivor.getPriceMin()).isEqualByComparingTo("132");
        assertThat(survivor.getPriceMax()).isEqualByComparingTo("139");
        assertThat(survivor.getLotSize()).isEqualTo(107);
        assertThat(survivor.getRegistrar()).isEqualTo("Link Intime");
        verify(listingRepo).save(survivor);
    }

    @Test
    void merge_clusterNoLongerDuplicated_skippedWithANote() {
        // The report and the apply are two separate calls, so the world can move in between.
        when(listingRepo.findLiveByAliasKey("acme"))
                .thenReturn(List.of(row("ipo-a", "Acme Ltd", "acme|2026-09-09", T0)));

        IpoDuplicateDto.MergeResult result = service().merge(List.of("acme"));

        assertThat(result.clustersMerged()).isZero();
        assertThat(result.rowsMerged()).isZero();
        assertThat(result.notes()).anySatisfy(n -> assertThat(n).contains("no longer a duplicate"));
        verify(listingRepo, never()).save(any());
    }

    @Test
    void merge_threeWayCluster_collapsesEveryLoserOntoOneSurvivor() {
        IpoListingEntity survivor = row("ipo-a", "Acme Ltd", "acme|2026-09-09", T0);
        survivor.setInvestorgainId(1234);
        IpoListingEntity loser1 = row("ipo-b", "Acme Limited", "acmex|2026-09-09", T0.plusSeconds(60));
        IpoListingEntity loser2 = row("ipo-c", "ACME Pvt Ltd", "acmey|2026-09-10", T0.plusSeconds(120));

        when(listingRepo.findDuplicateAliasKeys()).thenReturn(List.of("acme"));
        when(listingRepo.findLiveByAliasKey("acme")).thenReturn(List.of(survivor, loser1, loser2));

        IpoDuplicateDto.MergeResult result = service().mergeAll();

        assertThat(loser1.getMergedIntoId()).isEqualTo("ipo-a");
        assertThat(loser2.getMergedIntoId()).isEqualTo("ipo-a");
        assertThat(survivor.getMergedIntoId()).isNull();
        assertThat(result.rowsMerged()).isEqualTo(2);
        // No tombstone may point at another tombstone - the detail lookup relies on one hop.
        verify(changeEventRepo).repointToSurvivor("ipo-a", "ipo-b");
        verify(changeEventRepo).repointToSurvivor("ipo-a", "ipo-c");
        verify(changeEventRepo, never()).repointToSurvivor(eq("ipo-b"), anyString());
    }
}
