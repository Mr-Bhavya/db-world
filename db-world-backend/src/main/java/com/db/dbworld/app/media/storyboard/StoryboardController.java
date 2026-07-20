package com.db.dbworld.app.media.storyboard;

import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * Serves the generated scrub-preview sprite sheets that live under
 * {dataRoot}/storyboards/. The URL format mirrors what buildStoryboard() in
 * the frontend constructs: /storyboard/{mediaFileId}.jpg.
 *
 * Listed in PUBLIC_APIS — no auth token needed (UUIDs are opaque, and this
 * endpoint only exposes thumbnail images, not the actual video content).
 * Sprites are immutable once written, so the response carries a 1-year
 * Cache-Control header.
 */
@Log4j2
@RestController
@RequiredArgsConstructor
public class StoryboardController {

    private final StoryboardService storyboardService;

    @GetMapping("/storyboard/{mediaFileId}.jpg")
    public void getSprite(@PathVariable String mediaFileId, HttpServletResponse response) throws IOException {
        Path sprite = storyboardService.spritePath(mediaFileId);
        if (!Files.exists(sprite)) {
            response.sendError(HttpServletResponse.SC_NOT_FOUND);
            return;
        }
        response.setContentType("image/jpeg");
        response.setHeader("Cache-Control", "max-age=31536000, immutable");
        response.setContentLengthLong(Files.size(sprite));
        try (var in = Files.newInputStream(sprite)) {
            in.transferTo(response.getOutputStream());
        }
    }
}
