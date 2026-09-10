package com.db.dbworld.app.ipo.service;

import com.db.dbworld.app.ipo.dto.IpoDuplicateDto;
import com.db.dbworld.app.ipo.entity.IpoListingEntity;
import com.db.dbworld.app.ipo.repository.IpoChangeEventRepository;
import com.db.dbworld.app.ipo.repository.IpoFinancialRepository;
import com.db.dbworld.app.ipo.repository.IpoGmpHistoryRepository;
import com.db.dbworld.app.ipo.repository.IpoListingRepository;
import com.db.dbworld.app.ipo.repository.IpoSubscriptionHistoryRepository;
import com.db.dbworld.app.ipo.repository.IpoUserApplicationRepository;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.function.BiConsumer;
import java.util.function.Function;

/**
 * Finds and merges the duplicate {@code ipo_listing} rows that one company can accumulate.
 *
 * <h2>Why they exist</h2>
 * There is no shared identifier across the three feeds — no ISIN anywhere, and a ticker symbol only
 * after listing — so the company NAME is the identity. {@code match_key} is
 * {@code normalize(name)|openDate} and UNIQUE, and it splits one company in three separate ways: it
 * deletes punctuation instead of separating on it ({@code "Co.(India)"} against
 * {@code "Company (India)"}), it does not fold {@code "&"} into {@code "and"}, and it bakes in the
 * open date, so a revised or disagreed-upon schedule mints another row. Nothing retires the losers.
 *
 * <p>The visible symptom is two cards for one IPO where only one carries a GMP — and, worse, a
 * duplicate pair collapses to a single name for {@link InvestorgainMatcher}, which then reads it as
 * ambiguous and attributes GMP to NEITHER half.
 *
 * <h2>Why the merge is reviewed rather than automatic</h2>
 * Merging repoints GMP history, subscription history, financials, the audit trail and
 * {@code ipo_user_application} — the last of which is real user data. Name similarity genuinely
 * produces false positives: a company's SME issue and its later mainboard issue carry a
 * byte-identical name and must stay two rows. So {@link #report()} proposes and
 * {@link #mergeAll()} applies, and every merge is reversible — the loser is tombstoned via
 * {@code mergedIntoId} rather than deleted, keeping its own identity and dates.
 */
@Log4j2
@Service
public class IpoDuplicateService {

    private final IpoListingRepository listingRepo;
    private final IpoGmpHistoryRepository gmpHistoryRepo;
    private final IpoSubscriptionHistoryRepository subHistoryRepo;
    private final IpoFinancialRepository financialRepo;
    private final IpoChangeEventRepository changeEventRepo;
    private final IpoUserApplicationRepository userApplicationRepo;

    public IpoDuplicateService(IpoListingRepository listingRepo,
                               IpoGmpHistoryRepository gmpHistoryRepo,
                               IpoSubscriptionHistoryRepository subHistoryRepo,
                               IpoFinancialRepository financialRepo,
                               IpoChangeEventRepository changeEventRepo,
                               IpoUserApplicationRepository userApplicationRepo) {
        this.listingRepo = listingRepo;
        this.gmpHistoryRepo = gmpHistoryRepo;
        this.subHistoryRepo = subHistoryRepo;
        this.financialRepo = financialRepo;
        this.changeEventRepo = changeEventRepo;
        this.userApplicationRepo = userApplicationRepo;
    }

    /**
     * Picks the row a cluster should collapse onto, best first. Expressed as a comparator chain
     * rather than a weighted score so each rule can be justified on its own:
     * <ol>
     *   <li><b>Has an investorgain id.</b> Decisive — that id is what makes every future poll a
     *       straight lookup instead of a name gamble, so merging INTO it keeps GMP flowing.</li>
     *   <li><b>Most user applications.</b> Every application on a loser has to be moved; keeping
     *       the busiest row means touching the least real user data.</li>
     *   <li><b>Most GMP history</b>, then <b>has a current GMP</b> — the richer row wins.</li>
     *   <li><b>Oldest, then lowest id.</b> Pure tie-breaks, present so the choice is deterministic:
     *       a report and the merge that follows it must never disagree about the survivor.</li>
     * </ol>
     */
    private Comparator<IpoListingEntity> survivorOrder() {
        return Comparator
                .comparing((IpoListingEntity e) -> e.getInvestorgainId() != null).reversed()
                .thenComparing(Comparator.comparingLong(
                        (IpoListingEntity e) -> userApplicationRepo.countByIpoId(e.getId())).reversed())
                .thenComparing(Comparator.comparingLong(
                        (IpoListingEntity e) -> gmpHistoryRepo.countByIpoId(e.getId())).reversed())
                .thenComparing(Comparator.comparing((IpoListingEntity e) -> e.getGmp() != null).reversed())
                .thenComparing(IpoListingEntity::getFirstSeenAt,
                        Comparator.nullsLast(Comparator.naturalOrder()))
                .thenComparing(IpoListingEntity::getId, Comparator.nullsLast(Comparator.naturalOrder()));
    }

    /** Every duplicate cluster currently in the table, largest first. Read-only — changes nothing. */
    @Transactional(readOnly = true)
    public List<IpoDuplicateDto.Cluster> report() {
        List<IpoDuplicateDto.Cluster> clusters = new ArrayList<>();
        for (String aliasKey : listingRepo.findDuplicateAliasKeys()) {
            List<IpoListingEntity> rows = new ArrayList<>(listingRepo.findLiveByAliasKey(aliasKey));
            if (rows.size() < 2) {
                continue; // raced with a concurrent merge - nothing left to propose
            }
            rows.sort(survivorOrder());
            IpoListingEntity survivor = rows.get(0);
            List<IpoDuplicateDto.Row> losers = rows.subList(1, rows.size()).stream().map(this::toRow).toList();
            clusters.add(new IpoDuplicateDto.Cluster(aliasKey, toRow(survivor), losers));
        }
        clusters.sort(Comparator.comparingInt(IpoDuplicateDto.Cluster::size).reversed()
                .thenComparing(IpoDuplicateDto.Cluster::aliasKey));
        return clusters;
    }

    /** Applies every cluster {@link #report()} would propose. */
    @Transactional
    public IpoDuplicateDto.MergeResult mergeAll() {
        return merge(listingRepo.findDuplicateAliasKeys());
    }

    /** Applies only the named clusters — the "approve some, not all" path. */
    @Transactional
    public IpoDuplicateDto.MergeResult merge(List<String> aliasKeys) {
        int clusters = 0;
        int rows = 0;
        int applicationsMoved = 0;
        int applicationsDropped = 0;
        List<String> notes = new ArrayList<>();

        for (String aliasKey : aliasKeys) {
            List<IpoListingEntity> candidates = new ArrayList<>(listingRepo.findLiveByAliasKey(aliasKey));
            if (candidates.size() < 2) {
                notes.add("skipped '" + aliasKey + "': no longer a duplicate cluster");
                continue;
            }
            candidates.sort(survivorOrder());
            IpoListingEntity survivor = candidates.get(0);
            for (IpoListingEntity loser : candidates.subList(1, candidates.size())) {
                // Colliding rows are dropped BEFORE the repoint in every case: for applications
                // because (user_id, ipo_id) is UNIQUE and the update would throw, and for the
                // history tables because two rows for the same instant would draw a doubled series.
                List<String> collidingApplications =
                        userApplicationRepo.findCollidingIdsForMerge(survivor.getId(), loser.getId());
                userApplicationRepo.deleteAllById(collidingApplications);
                applicationsDropped += collidingApplications.size();
                applicationsMoved += userApplicationRepo.repointToSurvivor(survivor.getId(), loser.getId());

                gmpHistoryRepo.deleteAllById(
                        gmpHistoryRepo.findCollidingIdsForMerge(survivor.getId(), loser.getId()));
                gmpHistoryRepo.repointToSurvivor(survivor.getId(), loser.getId());
                subHistoryRepo.deleteAllById(
                        subHistoryRepo.findCollidingIdsForMerge(survivor.getId(), loser.getId()));
                subHistoryRepo.repointToSurvivor(survivor.getId(), loser.getId());
                financialRepo.deleteAllById(
                        financialRepo.findCollidingIdsForMerge(survivor.getId(), loser.getId()));
                financialRepo.repointToSurvivor(survivor.getId(), loser.getId());
                changeEventRepo.repointToSurvivor(survivor.getId(), loser.getId());

                fillMissingFrom(survivor, loser);
                // Tombstone rather than delete: the loser keeps its own row, dates and match_key, so
                // the merge can be undone by clearing merged_into_id and nothing is unrecoverable.
                loser.setMergedIntoId(survivor.getId());
                listingRepo.save(loser);
                rows++;
                notes.add("merged '" + loser.getCompanyName() + "' (" + loser.getId() + ") into '"
                        + survivor.getCompanyName() + "' (" + survivor.getId() + ")");
            }
            listingRepo.save(survivor);
            clusters++;
        }

        IpoDuplicateDto.MergeResult result =
                new IpoDuplicateDto.MergeResult(clusters, rows, applicationsMoved, applicationsDropped, notes);
        log.info("IPO duplicate merge: clusters={} rowsMerged={} applicationsMoved={} applicationsDropped={}",
                clusters, rows, applicationsMoved, applicationsDropped);
        return result;
    }

    /**
     * Copies values the survivor is MISSING from a row being merged away, and never overwrites one
     * it already has. That direction matters: the two halves of a duplicate pair usually hold
     * complementary fragments — one matched investorgain and carries the GMP, the other was ingested
     * from NSE and carries the price band and lot size — so a merge that only repointed history
     * would discard half the data that made the merge worth doing.
     */
    private void fillMissingFrom(IpoListingEntity survivor, IpoListingEntity loser) {
        fill(survivor, loser, IpoListingEntity::getInvestorgainId, IpoListingEntity::setInvestorgainId);
        fill(survivor, loser, IpoListingEntity::getGmp, IpoListingEntity::setGmp);
        fill(survivor, loser, IpoListingEntity::getGmpPct, IpoListingEntity::setGmpPct);
        fill(survivor, loser, IpoListingEntity::getGmpRating, IpoListingEntity::setGmpRating);
        fill(survivor, loser, IpoListingEntity::getSubTotal, IpoListingEntity::setSubTotal);
        fill(survivor, loser, IpoListingEntity::getPriceMin, IpoListingEntity::setPriceMin);
        fill(survivor, loser, IpoListingEntity::getPriceMax, IpoListingEntity::setPriceMax);
        fill(survivor, loser, IpoListingEntity::getLotSize, IpoListingEntity::setLotSize);
        fill(survivor, loser, IpoListingEntity::getIssueSize, IpoListingEntity::setIssueSize);
        fill(survivor, loser, IpoListingEntity::getOpenDate, IpoListingEntity::setOpenDate);
        fill(survivor, loser, IpoListingEntity::getCloseDate, IpoListingEntity::setCloseDate);
        fill(survivor, loser, IpoListingEntity::getAllotmentDate, IpoListingEntity::setAllotmentDate);
        fill(survivor, loser, IpoListingEntity::getListingDate, IpoListingEntity::setListingDate);
        fill(survivor, loser, IpoListingEntity::getListingPrice, IpoListingEntity::setListingPrice);
        fill(survivor, loser, IpoListingEntity::getListingGainPct, IpoListingEntity::setListingGainPct);
        fill(survivor, loser, IpoListingEntity::getRegistrar, IpoListingEntity::setRegistrar);
        fill(survivor, loser, IpoListingEntity::getRegistrarUrl, IpoListingEntity::setRegistrarUrl);
        fill(survivor, loser, IpoListingEntity::getLogoUrl, IpoListingEntity::setLogoUrl);
        fill(survivor, loser, IpoListingEntity::getAbout, IpoListingEntity::setAbout);
        fill(survivor, loser, IpoListingEntity::getTickerSymbol, IpoListingEntity::setTickerSymbol);
        fill(survivor, loser, IpoListingEntity::getAllotmentLink, IpoListingEntity::setAllotmentLink);
    }

    private <T> void fill(IpoListingEntity survivor, IpoListingEntity loser,
                          Function<IpoListingEntity, T> getter, BiConsumer<IpoListingEntity, T> setter) {
        if (getter.apply(survivor) == null && getter.apply(loser) != null) {
            setter.accept(survivor, getter.apply(loser));
        }
    }

    private IpoDuplicateDto.Row toRow(IpoListingEntity e) {
        return new IpoDuplicateDto.Row(e.getId(), e.getCompanyName(), e.getMatchKey(), e.getStatus(),
                e.getOpenDate(), e.getCloseDate(), e.getListingDate(), e.getGmp(), e.getInvestorgainId(),
                gmpHistoryRepo.countByIpoId(e.getId()), userApplicationRepo.countByIpoId(e.getId()),
                e.getFirstSeenAt());
    }
}
