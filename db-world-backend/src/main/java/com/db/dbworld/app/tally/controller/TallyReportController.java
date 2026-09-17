package com.db.dbworld.app.tally.controller;

import com.db.dbworld.app.tally.dto.TallyGroupReportDto;
import com.db.dbworld.app.tally.dto.TallyReportPeriod;
import com.db.dbworld.app.tally.dto.TallySpendingReportDto;
import com.db.dbworld.app.tally.service.TallyReportService;
import com.db.dbworld.core.context.UserContext;
import com.db.dbworld.core.role.annotations.AnyRole;
import com.db.dbworld.payloads.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

/**
 * Reports across the caller's ledgers.
 *
 * <p>No group id in the path, unlike the rest of the module: these read across every ledger the
 * caller is in, and the only access check there is to make is that they are asking about
 * themselves — which the token already settles.
 */
@RestController
@RequestMapping("/api/tally/reports")
@RequiredArgsConstructor
@AnyRole
public class TallyReportController {

    private final TallyReportService reports;
    private final UserContext userContext;

    /**
     * What the caller consumed over one week, month or year.
     *
     * <p>{@code anchor} is any date inside the period, not its first day, so paging back is
     * "give me the week around the 3rd" rather than the client having to work out which Monday
     * that was. Omit it for the current period.
     *
     * <p>{@code from} and {@code to} are the other way to ask, and they win when both are given:
     * an arbitrary range has no anchor and no calendar period to belong to. The comparison the
     * report draws behind it then becomes the equally long stretch immediately before, rather
     * than "the previous month" — see {@link com.db.dbworld.app.tally.dto.TallyReportWindow}.
     */
    @GetMapping("/spending")
    public ResponseEntity<ApiResponse<TallySpendingReportDto>> spending(
            @RequestParam(defaultValue = "MONTH") TallyReportPeriod period,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate anchor,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return TallyResponses.ok(reports.spending(userContext.userId(), period, anchor, from, to));
    }

    /**
     * What one group spent, and who carried it.
     *
     * <p>Addressed under the group rather than as another query parameter on {@code /spending}:
     * it is a different report, not the same one narrowed. The figures are the group's whole
     * spend and a paid-versus-consumed split per member, where {@code /spending} is only ever
     * the caller's own share — one endpoint answering both would have half its fields null
     * depending on how it was called.
     *
     * <p>{@code from} and {@code to} are the other way to ask, and they win when both are given:
     * an arbitrary range has no anchor and no calendar period to belong to. The comparison the
     * report draws behind it then becomes the equally long stretch immediately before, rather
     * than "the previous month" — see {@link com.db.dbworld.app.tally.dto.TallyReportWindow}.
     */
    @GetMapping("/groups/{groupId}")
    public ResponseEntity<ApiResponse<TallyGroupReportDto>> group(
            @PathVariable String groupId,
            @RequestParam(defaultValue = "MONTH") TallyReportPeriod period,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate anchor,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return TallyResponses.ok(
                reports.group(userContext.userId(), groupId, period, anchor, from, to));
    }
}
