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
        // TMDB occasionally returns null for `adult` on /tv/changes and /movie/changes;
        // keep this as the boxed type so a null payload doesn't fail the whole batch.
        private Boolean adult;
    }
}