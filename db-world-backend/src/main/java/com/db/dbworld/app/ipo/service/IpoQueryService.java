package com.db.dbworld.app.ipo.service;

import com.db.dbworld.app.ipo.dto.GmpPointDto;
import com.db.dbworld.app.ipo.dto.IpoDetailDto;
import com.db.dbworld.app.ipo.dto.IpoListResponse;
import com.db.dbworld.app.ipo.dto.IpoSummaryDto;
import com.db.dbworld.app.ipo.dto.SubscriptionPointDto;
import com.db.dbworld.app.ipo.entity.IpoListingEntity;
import com.db.dbworld.app.ipo.mapper.IpoMapper;
import com.db.dbworld.app.ipo.repository.IpoGmpHistoryRepository;
import com.db.dbworld.app.ipo.repository.IpoListingRepository;
import com.db.dbworld.app.ipo.repository.IpoSubscriptionHistoryRepository;
import com.db.dbworld.core.exception.DbWorldException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.Comparator;
import java.util.List;

/**
 * Read-only queries behind the IPO tracker's user-facing endpoints: the list view (each row plus
 * a "last updated" stamp sourced from {@link IpoSourcePollService}), the detail page, and the
 * GMP / subscription history series that feed the frontend's charts.
 */
@Service
public class IpoQueryService {

    /** Newest open date first; IPOs with no open date yet (not announced) sort to the end. */
    private static final Comparator<IpoListingEntity> LIST_ORDER =
            Comparator.comparing(IpoListingEntity::getOpenDate, Comparator.nullsLast(Comparator.reverseOrder()));

    private final IpoListingRepository listingRepository;
    private final IpoGmpHistoryRepository gmpHistoryRepository;
    private final IpoSubscriptionHistoryRepository subscriptionHistoryRepository;
    private final IpoSourcePollService pollService;
    private final IpoMapper mapper;

    public IpoQueryService(IpoListingRepository listingRepository,
                            IpoGmpHistoryRepository gmpHistoryRepository,
                            IpoSubscriptionHistoryRepository subscriptionHistoryRepository,
                            IpoSourcePollService pollService,
                            IpoMapper mapper) {
        this.listingRepository = listingRepository;
        this.gmpHistoryRepository = gmpHistoryRepository;
        this.subscriptionHistoryRepository = subscriptionHistoryRepository;
        this.pollService = pollService;
        this.mapper = mapper;
    }

    /** All IPOs (optionally filtered by {@code status}), newest open date first. */
    public IpoListResponse list(String status) {
        List<IpoListingEntity> entities = StringUtils.hasText(status)
                ? listingRepository.findByStatus(status)
                : listingRepository.findAll();
        List<IpoSummaryDto> ipos = entities.stream()
                .sorted(LIST_ORDER)
                .map(mapper::toSummary)
                .toList();
        return new IpoListResponse(ipos, pollService.lastSuccessAcrossSources().orElse(null));
    }

    public IpoDetailDto detail(String id) {
        IpoListingEntity entity = listingRepository.findById(id)
                .orElseThrow(() -> new DbWorldException(HttpStatus.NOT_FOUND, "IPO not found"));
        return mapper.toDetail(entity);
    }

    /** Chronological GMP series for the chart; empty (not 404) if the IPO has no history yet. */
    public List<GmpPointDto> gmpHistory(String id) {
        return gmpHistoryRepository.findByIpoIdOrderByCapturedAtAsc(id).stream()
                .map(mapper::toGmpPoint)
                .toList();
    }

    /** Chronological subscription series for the chart; empty (not 404) if none captured yet. */
    public List<SubscriptionPointDto> subscriptionHistory(String id) {
        return subscriptionHistoryRepository.findByIpoIdOrderByCapturedAtAsc(id).stream()
                .map(mapper::toSubscriptionPoint)
                .toList();
    }
}
