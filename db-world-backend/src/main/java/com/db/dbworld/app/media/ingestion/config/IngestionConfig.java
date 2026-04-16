package com.db.dbworld.app.media.ingestion.config;

import com.db.dbworld.app.cinema.catalog.repository.RecordRepository;
import com.db.dbworld.app.media.ingestion.persistence.IngestionRepository;
import com.db.dbworld.app.media.ingestion.pipeline.DefaultIngestionPipeline;
import com.db.dbworld.app.media.ingestion.pipeline.IngestionPipeline;
import com.db.dbworld.app.media.ingestion.queue.IngestionDownloadQueue;
import com.db.dbworld.app.media.ingestion.spi.DownloadStrategy;
import com.db.dbworld.app.media.ingestion.spi.ProcessingStrategy;
import com.db.dbworld.app.media.ingestion.spi.SourceHandler;
import com.db.dbworld.app.media.ingestion.store.IngestionJobStore;
import com.db.dbworld.app.media.ingestion.tracking.TrackingService;
import lombok.extern.log4j.Log4j2;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Log4j2
@Configuration
public class IngestionConfig {

    @Bean(name = "ingestionJobExecutor", destroyMethod = "shutdown")
    public ExecutorService ingestionJobExecutor() {
        try {
            ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();
            log.info("Ingestion pipeline: virtual-thread executor active");
            return executor;
        } catch (Exception e) {
            log.warn("Virtual threads unavailable, falling back to cached thread pool");
            return Executors.newCachedThreadPool(r -> {
                Thread t = new Thread(r, "ingestion-job-");
                t.setDaemon(true);
                return t;
            });
        }
    }

    @Bean
    public IngestionPipeline ingestionPipeline(
            List<SourceHandler>      sourceHandlers,
            List<DownloadStrategy>   downloadStrategies,
            List<ProcessingStrategy> processingStrategies,
            TrackingService          trackingService,
            IngestionRepository      ingestionRepository,
            ExecutorService          ingestionJobExecutor,
            IngestionJobStore        jobStore,
            IngestionDownloadQueue   downloadQueue,
            RecordRepository         recordRepository
    ) {
        log.info("Configuring IngestionPipeline: {} sources, {} downloaders, {} processors",
                sourceHandlers.size(), downloadStrategies.size(), processingStrategies.size());

        return new DefaultIngestionPipeline(
                sourceHandlers,
                downloadStrategies,
                processingStrategies,
                trackingService,
                ingestionRepository,
                ingestionJobExecutor,
                jobStore,
                downloadQueue,
                recordRepository
        );
    }
}
