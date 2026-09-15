package com.db.dbworld.app.tally.dto;

import com.db.dbworld.app.tally.service.importer.SplitwiseCsv;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * A Splitwise export, sent as text rather than as an upload.
 *
 * <p>Multipart would have meant a second endpoint: {@code CapacitorHttp} corrupts binary
 * multipart bodies, so every upload in this repo that the phone app can reach carries a
 * base64/JSON twin beside it. A CSV is already text and a few kilobytes of it, so posting the
 * string sidesteps that entirely — one endpoint that works everywhere, and no encoding step on
 * either side.
 *
 * <p>The size cap is enforced here and again in the parser, because
 * {@code spring.servlet.multipart.max-*-size} is {@code -1} in this application: the container
 * imposes no limit of its own on anything.
 */
public record SplitwisePreviewRequest(
        @NotBlank @Size(max = SplitwiseCsv.MAX_CHARS) String csv
) {}
