package com.db.dbworld.app.cinema.editorial;

import com.db.dbworld.app.admin.scheduler.dto.JobRunSummary;
import com.db.dbworld.app.cinema.catalog.repository.RecordRepository;
import com.db.dbworld.app.admin.config.registry.ConfigKeys;
import com.db.dbworld.app.admin.config.service.SettingsService;
import com.db.dbworld.core.exception.DbWorldException;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;

import java.util.List;

@Log4j2
@Component
@RequiredArgsConstructor
public class RecordEditorialAiScheduler {

    public static final String JOB_ID = "CinemaEditorialAi";

    private final RecordRepository recordRepository;
    private final RecordEditorialAiService editorialAiService;
    private final SettingsService settingsService;

    public void run(JobRunSummary.Builder summary) {
        int batchSize = settingsService.getInt(ConfigKeys.CINEMA_AI_EDITORIAL_BATCH_SIZE);
        List<Long> ids = recordRepository.findPublishedIdsWithoutEditorial(
                PageRequest.of(0, Math.max(1, batchSize)));
        summary.count("selected", ids.size())
                .count("generated", 0)
                .count("failed", 0)
                .note("Ollama model: " + editorialAiService.model()
                        + "; newest published records first");

        if (ids.isEmpty()) {
            summary.note("No published records are missing editorial content");
            return;
        }

        int generated = 0;
        int failed = 0;
        for (Long id : ids) {
            try {
                editorialAiService.generate(id, false);
                generated++;
                summary.count("generated", generated);
            } catch (DbWorldException error) {
                if (error.getHttpStatus().value() != 422) throw error;
                summary.count("failed", ++failed)
                        .note("Record " + id + " skipped: " + error.getMessage());
            } catch (Exception error) {
                throw error;
            }
            if (Thread.currentThread().isInterrupted()) {
                summary.note("Cancelled after " + generated + " generated records");
                return;
            }
        }
    }
}
