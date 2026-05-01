package com.db.dbworld.app.media.ingestion.download;

/**
 * Marker interface that extends the SPI contract.
 * All concrete download strategies in this package implement this interface,
 * and are therefore automatically registered as spi.DownloadStrategy beans.
 */
public interface DownloadStrategy extends com.db.dbworld.app.media.ingestion.spi.DownloadStrategy {
}
