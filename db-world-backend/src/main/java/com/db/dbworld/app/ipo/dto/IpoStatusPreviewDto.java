package com.db.dbworld.app.ipo.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/** Admin dry run of the next status sweep. Nothing is written by producing it. */
public final class IpoStatusPreviewDto {

    private IpoStatusPreviewDto() {}

    /**
     * @param hiddenFromPublicList true when the row becomes "listed" but the public list already
     *        hides listings older than {@code hideListedAfterDays}, so it will not appear under
     *        "Recently listed"
     */
    public record Row(String id, String companyName, String ipoType, String currentStatus,
                      String proposedStatus, LocalDate listingDate, BigDecimal listingPrice,
                      boolean announces, boolean hiddenFromPublicList) {}

    /** @param hideListedAfterDays current {@code ipo.list.hide-listed-after-days}; 0 means never hide */
    public record Report(long hideListedAfterDays, List<Row> changes) {}
}
