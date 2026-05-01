package com.db.dbworld.app.cinema.tmdb.client.dto;

import lombok.Data;
import java.util.List;

@Data
public class TmdbChangeResponse {

    private int page;
    private int total_pages;
    private int total_results;
    private List<ChangeItem> results;

    @Data
    public static class ChangeItem {
        private Long id;
        private boolean adult;
    }
}