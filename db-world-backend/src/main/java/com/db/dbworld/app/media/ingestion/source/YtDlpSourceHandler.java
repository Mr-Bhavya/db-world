package com.db.dbworld.app.media.ingestion.source;

import com.db.dbworld.app.media.ingestion.model.SourceMetadata;
import com.db.dbworld.app.media.ingestion.spi.SourceHandler;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.Set;

/**
 * Handles YouTube and other streaming-site URLs (HotStar, Prime, etc.).
 * These are downloaded via yt-dlp.
 * Evaluated BEFORE HttpSourceHandler (Order = 1).
 */
@Component
@Order(1)
public class YtDlpSourceHandler implements SourceHandler {

    private static final Set<String> YTDLP_DOMAINS = Set.of(
            "youtube.com",
            "youtu.be",
            "m.youtube.com",
            "jiohotstar.com",
            "hotstar.com",
            "primevideo.com",
            "netflix.com",
            "disneyplus.com",
            "zee5.com",
            "sonyliv.com",
            "voot.com",
            "jiocinema.com",
            "mxplayer.in",
            "twitch.tv",
            "dailymotion.com",
            "vimeo.com"
    );

    @Override
    public boolean supports(String uri) {
        if (uri == null || uri.isBlank()) return false;
        String lower = uri.toLowerCase();
        return YTDLP_DOMAINS.stream().anyMatch(lower::contains);
    }

    @Override
    public SourceMetadata resolve(String uri) {
        SourceMetadata meta = new SourceMetadata();
        meta.setUri(uri);
        meta.setType("YOUTUBE");
        meta.setAttributes(Map.of(
                "originalUri", uri,
                "handler", "yt-dlp",
                "platform", detectPlatform(uri.toLowerCase())
        ));
        return meta;
    }

    private static String detectPlatform(String lower) {
        if (lower.contains("hotstar.com") || lower.contains("jiohotstar.com")) return "HOTSTAR";
        if (lower.contains("primevideo.com")) return "AMAZON";
        if (lower.contains("netflix.com"))    return "NETFLIX";
        if (lower.contains("disneyplus.com")) return "DISNEY";
        if (lower.contains("zee5.com"))       return "ZEE5";
        if (lower.contains("sonyliv.com"))    return "SONYLIV";
        if (lower.contains("voot.com"))       return "VOOT";
        if (lower.contains("mxplayer.in"))    return "MXPLAYER";
        if (lower.contains("jiocinema.com"))  return "JIOCINEMA";
        return "YOUTUBE";
    }
}
