package com.db.dbworld.app.ipo.mapper;

import com.db.dbworld.app.ipo.dto.*;
import com.db.dbworld.app.ipo.entity.*;
import org.springframework.stereotype.Component;

@Component
public class IpoMapper {

    public IpoSummaryDto toSummary(IpoListingEntity e) {
        return new IpoSummaryDto(e.getId(), e.getCompanyName(), e.getIpoType(), e.getStatus(),
                e.getOpenDate(), e.getCloseDate(), e.getListingDate(), e.getPriceMin(), e.getPriceMax(),
                e.getGmp(), e.getGmpPct(), e.getListingExchange(), e.getListingGainPct(), e.getAllotmentStatus());
    }

    public IpoDetailDto toDetail(IpoListingEntity e) {
        return new IpoDetailDto(e.getId(), e.getCompanyName(), e.getIpoType(), e.getStatus(),
                e.getOpenDate(), e.getCloseDate(), e.getAllotmentDate(), e.getListingDate(),
                e.getPriceMin(), e.getPriceMax(), e.getListingPrice(), e.getListingGainPct(),
                e.getGmp(), e.getGmpPct(), e.getSubTotal(), e.getLotSize(), e.getIssueSize(),
                e.getListingExchange(), e.getAllotmentStatus(), e.getRegistrar(), e.getRegistrarUrl());
    }

    public GmpPointDto toGmpPoint(IpoGmpHistoryEntity e) {
        return new GmpPointDto(e.getCapturedAt(), e.getGmp(), e.getGmpPct());
    }

    public SubscriptionPointDto toSubscriptionPoint(IpoSubscriptionHistoryEntity e) {
        return new SubscriptionPointDto(e.getCapturedAt(), e.getQib(), e.getNii(), e.getRetail(), e.getTotal());
    }

    public IpoChangeDto toChangeDto(IpoChangeEventEntity e) {
        return new IpoChangeDto(e.getIpoId(), e.getEventType(), e.getOldValue(), e.getNewValue(), e.getCreatedAt());
    }

    public SourceHealthDto toSourceHealth(IpoSourcePollEntity e) {
        return new SourceHealthDto(e.getSource(), e.getLastPolledAt(), e.getLastSuccessAt(),
                e.getLastStatus(), e.getConsecutiveFailures());
    }
}
