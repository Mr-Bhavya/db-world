package com.db.dbworld.app.media.ingestion.source;

import com.db.dbworld.app.media.ingestion.model.SourceMetadata;
import com.db.dbworld.app.media.ingestion.spi.SourceHandler;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Handles plain HTTP/HTTPS URLs and magnet/torrent links.
 * These are downloaded via Aria2c.
 * Fallback handler (Order = 100), evaluated after YtDlpSourceHandler.
 */
@Component
@Order(100)
public class HttpSourceHandler implements SourceHandler {

    @Override
    public boolean supports(String uri) {
        if (uri == null || uri.isBlank()) return false;
        String lower = uri.toLowerCase();
        return lower.startsWith("http://")
                || lower.startsWith("https://")
                || lower.startsWith("magnet:")
                || lower.endsWith(".torrent");
    }

    @Override
    public SourceMetadata resolve(String uri) {
        SourceMetadata meta = new SourceMetadata();
        meta.setUri(uri);
        String type = isMagnetOrTorrent(uri) ? "TORRENT" : "HTTP";
        meta.setType(type);
        meta.setAttributes(Map.of(
                "originalUri", uri,
                "handler", "aria2",
                "isMagnet", String.valueOf(isMagnetOrTorrent(uri))
        ));
        return meta;
    }

    private boolean isMagnetOrTorrent(String uri) {
        String lower = uri.toLowerCase();
        return lower.startsWith("magnet:") || lower.endsWith(".torrent");
    }
}
