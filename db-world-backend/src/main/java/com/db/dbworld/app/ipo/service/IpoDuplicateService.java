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
     *
     * <p><b>Every</b> field carrying IPO data is copied, deliberately. An earlier version listed
     * only the ones a duplicate pair was expected to disagree about, and {@code status} was not
     * among them — which broke the merge in the most visible way possible. {@link #survivorOrder()}
     * treats an investorgain id as decisive, and the investorgain row is precisely the one that
     * never carries a lifecycle status (that service only ever updates rows the ingest path
     * created, it never creates one). So a merge promoted the statusless half and tombstoned the
     * half that had the status: the surviving card dropped out of "Awaiting listing" and into the
     * catch-all "Other" section wearing an "Unknown" chip, and — because status is what the list
     * filters on — became unreachable from the status filter entirely. {@code ipoType} and
     * {@code listingExchange} went the same way, losing the Mainboard/SME chip and the exchange.
     *
     * <p>The only fields left out are identity and merge bookkeeping — {@code id}, {@code matchKey},
     * {@code aliasKey}, {@code mergedIntoId}, {@code companyName}, {@code firstSeenAt},
     * {@code lastSeenAt}, {@code updatedAt} — each of which must keep describing the survivor's own
     * row, plus {@code gmpRefreshedAt}: it timestamps the survivor's last GMP fetch, and leaving it
     * null when the GMP was inherited reads as "never refreshed", which puts the row at the FRONT
     * of the staleness-ordered fetch queue and self-corrects on the next tick. Inheriting the
     * loser's timestamp would instead claim a freshness the survivor hasn't earned.
     * {@code IpoDuplicateServiceTest} enforces this split by reflection, so a field added to the
     * entity later cannot be silently dropped the way {@code status} was.
     */
    private void fillMissingFrom(IpoListingEntity survivor, IpoListingEntity loser) {
        // Lifecycle — what the list groups, filters and colours by. The status bug lived here.
        fill(survivor, loser, IpoListingEntity::getStatus, IpoListingEntity::setStatus);
        fill(survivor, loser, IpoListingEntity::getIpoType, IpoListingEntity::setIpoType);
        fill(survivor, loser, IpoListingEntity::getListingExchange, IpoListingEntity::setListingExchange);
        fill(survivor, loser, IpoListingEntity::getAllotmentStatus, IpoListingEntity::setAllotmentStatus);

        // Dates
        fill(survivor, loser, IpoListingEntity::getOpenDate, IpoListingEntity::setOpenDate);
        fill(survivor, loser, IpoListingEntity::getCloseDate, IpoListingEntity::setCloseDate);
        fill(survivor, loser, IpoListingEntity::getAllotmentDate, IpoListingEntity::setAllotmentDate);
        fill(survivor, loser, IpoListingEntity::getRefundDate, IpoListingEntity::setRefundDate);
        fill(survivor, loser, IpoListingEntity::getDematDate, IpoListingEntity::setDematDate);
        fill(survivor, loser, IpoListingEntity::getListingDate, IpoListingEntity::setListingDate);

        // Pricing and issue structure
        fill(survivor, loser, IpoListingEntity::getPriceMin, IpoListingEntity::setPriceMin);
        fill(survivor, loser, IpoListingEntity::getPriceMax, IpoListingEntity::setPriceMax);
        fill(survivor, loser, IpoListingEntity::getLotSize, IpoListingEntity::setLotSize);
        fill(survivor, loser, IpoListingEntity::getIssueSize, IpoListingEntity::setIssueSize);
        fill(survivor, loser, IpoListingEntity::getFaceValue, IpoListingEntity::setFaceValue);
        fill(survivor, loser, IpoListingEntity::getFreshIssue, IpoListingEntity::setFreshIssue);
        fill(survivor, loser, IpoListingEntity::getOfferForSale, IpoListingEntity::setOfferForSale);
        fill(survivor, loser, IpoListingEntity::getListingPrice, IpoListingEntity::setListingPrice);
        fill(survivor, loser, IpoListingEntity::getListingGainPct, IpoListingEntity::setListingGainPct);

        // Grey market / subscription, and the investorgain id that keeps both flowing
        fill(survivor, loser, IpoListingEntity::getInvestorgainId, IpoListingEntity::setInvestorgainId);
        fill(survivor, loser, IpoListingEntity::getGmp, IpoListingEntity::setGmp);
        fill(survivor, loser, IpoListingEntity::getGmpPct, IpoListingEntity::setGmpPct);
        fill(survivor, loser, IpoListingEntity::getGmpRating, IpoListingEntity::setGmpRating);
        fill(survivor, loser, IpoListingEntity::getGmpMin, IpoListingEntity::setGmpMin);
        fill(survivor, loser, IpoListingEntity::getGmpMax, IpoListingEntity::setGmpMax);
        fill(survivor, loser, IpoListingEntity::getGmpUpdatedLabel, IpoListingEntity::setGmpUpdatedLabel);
        fill(survivor, loser, IpoListingEntity::getEstimatedListingPrice, IpoListingEntity::setEstimatedListingPrice);
        fill(survivor, loser, IpoListingEntity::getSubjectToSauda, IpoListingEntity::setSubjectToSauda);
        fill(survivor, loser, IpoListingEntity::getEstProfit, IpoListingEntity::setEstProfit);
        fill(survivor, loser, IpoListingEntity::getPeRatio, IpoListingEntity::setPeRatio);
        fill(survivor, loser, IpoListingEntity::getAnchorInvestor, IpoListingEntity::setAnchorInvestor);
        fill(survivor, loser, IpoListingEntity::getSubTotal, IpoListingEntity::setSubTotal);
        fill(survivor, loser, IpoListingEntity::getSubscriptionUpdatedLabel,
                IpoListingEntity::setSubscriptionUpdatedLabel);

        // Registrar and allotment
        fill(survivor, loser, IpoListingEntity::getRegistrar, IpoListingEntity::setRegistrar);
        fill(survivor, loser, IpoListingEntity::getRegistrarUrl, IpoListingEntity::setRegistrarUrl);
        fill(survivor, loser, IpoListingEntity::getAllotmentLink, IpoListingEntity::setAllotmentLink);

        // Company profile and the detail page's long-form sections
        fill(survivor, loser, IpoListingEntity::getLogoUrl, IpoListingEntity::setLogoUrl);
        fill(survivor, loser, IpoListingEntity::getLogoDomain, IpoListingEntity::setLogoDomain);
        fill(survivor, loser, IpoListingEntity::getAbout, IpoListingEntity::setAbout);
        fill(survivor, loser, IpoListingEntity::getTickerSymbol, IpoListingEntity::setTickerSymbol);
        fill(survivor, loser, IpoListingEntity::getStrengths, IpoListingEntity::setStrengths);
        fill(survivor, loser, IpoListingEntity::getRisks, IpoListingEntity::setRisks);
        fill(survivor, loser, IpoListingEntity::getKpisJson, IpoListingEntity::setKpisJson);
        fill(survivor, loser, IpoListingEntity::getIssueObjectsJson, IpoListingEntity::setIssueObjectsJson);
        fill(survivor, loser, IpoListingEntity::getIssueDetailsJson, IpoListingEntity::setIssueDetailsJson);
        fill(survivor, loser, IpoListingEntity::getLeadManagers, IpoListingEntity::setLeadManagers);
        fill(survivor, loser, IpoListingEntity::getFoundedYear, IpoListingEntity::setFoundedYear);
        fill(survivor, loser, IpoListingEntity::getManagingDirector, IpoListingEntity::setManagingDirector);
        fill(survivor, loser, IpoListingEntity::getParentCompany, IpoListingEntity::setParentCompany);
        fill(survivor, loser, IpoListingEntity::getSector, IpoListingEntity::setSector);
        fill(survivor, loser, IpoListingEntity::getHeadquarters, IpoListingEntity::setHeadquarters);
        fill(survivor, loser, IpoListingEntity::getWebsite, IpoListingEntity::setWebsite);

        // Carried so the survivor inherits "the closing-soon push already went out for this
        // company" — the two rows were one IPO, so re-sending it would be a duplicate alert.
        fill(survivor, loser, IpoListingEntity::getClosingSoonNotifiedAt,
                IpoListingEntity::setClosingSoonNotifiedAt);
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
