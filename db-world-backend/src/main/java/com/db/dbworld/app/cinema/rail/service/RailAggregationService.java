package com.db.dbworld.app.cinema.rail.service;

import com.db.dbworld.app.cinema.rail.dto.RailAggregationResult;

import java.util.List;

public interface RailAggregationService {

    RailAggregationResult aggregate(List<Long> tmdbIds);

}