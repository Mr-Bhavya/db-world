package com.db.dbworld.app.tally.controller;

import com.db.dbworld.app.tally.dto.SplitwiseImportRequest;
import com.db.dbworld.app.tally.dto.SplitwiseImportResultDto;
import com.db.dbworld.app.tally.dto.SplitwisePreviewDto;
import com.db.dbworld.app.tally.dto.SplitwisePreviewRequest;
import com.db.dbworld.app.tally.service.importer.TallyImportService;
import com.db.dbworld.core.context.UserContext;
import com.db.dbworld.core.role.annotations.AnyRole;
import com.db.dbworld.payloads.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Bringing an existing Splitwise group in.
 *
 * <p>Both handlers take the CSV as a JSON string rather than a multipart upload. That is not
 * laziness: {@code CapacitorHttp} mangles binary multipart bodies, so every upload in this repo
 * the phone app can reach needs a base64 twin beside it. A CSV is text, and a few kilobytes of
 * it, so one endpoint taking a string works on web and on the app with no encoding either side.
 */
@RestController
@RequestMapping("/api/tally/import/splitwise")
@RequiredArgsConstructor
@AnyRole
public class TallyImportController {

    private final TallyImportService imports;
    private final UserContext userContext;

    /**
     * Reads the file and writes nothing.
     *
     * <p>A POST because it carries a body, not because it changes anything. The file has names
     * and no accounts in it, so the caller has to say who each column is before this can be
     * committed — and any row the export could not describe exactly is worth seeing first.
     */
    @PostMapping("/preview")
    public ResponseEntity<ApiResponse<SplitwisePreviewDto>> preview(
            @Valid @RequestBody SplitwisePreviewRequest request) {
        return TallyResponses.ok(imports.preview(request.csv()));
    }

    /**
     * Commits the export into a new group, or saves nothing at all.
     *
     * <p>201, because the thing that now exists is a group. Every balance is checked against the
     * export's own closing figures inside the transaction, so a mismatch answers 422 and leaves
     * no trace rather than a half-imported ledger nobody can unpick.
     */
    @PostMapping
    public ResponseEntity<ApiResponse<SplitwiseImportResultDto>> importGroup(
            @Valid @RequestBody SplitwiseImportRequest request) {
        var result = imports.importGroup(userContext.userId(), request);
        return TallyResponses.created(
                "Imported %d expenses and %d payments into %s"
                        .formatted(result.expensesCreated(), result.settlementsCreated(),
                                result.group().name()),
                result);
    }
}
