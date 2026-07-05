package com.db.dbworld.audit.tracking.admin.dto;

public interface SearchKeywordProjection {
    String getQueryNorm();
    Long getSearchCount();
    Long getZeroResultCount();
}
