package com.db.dbworld.app.cinema.bootstrap.service;

import com.db.dbworld.cinema.catalog.entities.RecordEntity;
import com.db.dbworld.cinema.catalog.entities.RecordTagEntity;
import com.db.dbworld.cinema.catalog.repository.RecordRepository;
import com.db.dbworld.cinema.enums.RecordTagType;
import com.db.dbworld.cinema.enums.RecordType;
import com.db.dbworld.cinema.tmdb.entities.MovieTmdbEntity;
import com.db.dbworld.cinema.tmdb.entities.TvSeriesTmdbEntity;
import com.db.dbworld.cinema.tmdb.ingestion.TmdbIngestionService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class CatalogBootstrapService {

    private final TmdbIngestionService tmdbIngestionService;
    private final RecordRepository recordRepository;
    private final RailBootstrapService railBootstrapService;

    public void bootstrap() {

        List<RecordEntity> records = new ArrayList<>();

//        records.addAll(ingestMovies(List.of(
//                157336L, // Interstellar
//                27205L,  // Inception
//                603L,    // Matrix
//                550L,    // Fight Club
//                680L     // Pulp Fiction
//        )));
//
//        records.addAll(ingestSeries(List.of(
//                1399L,   // Game of Thrones
//                1396L,   // Breaking Bad
//                66732L   // Stranger Things
//        )));

//        assignTags(records);

        railBootstrapService.generateRails();
    }

    /* ======================================================
       INGEST MOVIES
       ====================================================== */

    private List<RecordEntity> ingestMovies(List<Long> ids) {

        List<RecordEntity> records = new ArrayList<>();

        for (Long tmdbId : ids) {

            MovieTmdbEntity tmdb = tmdbIngestionService.ingestMovie(tmdbId);

            RecordEntity record = recordRepository.findByTmdb_Id(tmdbId)
                    .orElseGet(() -> {

                        RecordEntity entity = RecordEntity.builder()
                                .name(tmdb.getTitle())
                                .type(RecordType.MOVIE)
                                .tmdb(tmdb)
                                .build();

                        return recordRepository.save(entity);
                    });

            records.add(record);
        }

        return records;
    }

    /* ======================================================
       INGEST SERIES
       ====================================================== */

    private List<RecordEntity> ingestSeries(List<Long> ids) {

        List<RecordEntity> records = new ArrayList<>();

        for (Long tmdbId : ids) {

            TvSeriesTmdbEntity tmdb = tmdbIngestionService.ingestTvSeries(tmdbId);

            RecordEntity record = recordRepository.findByTmdb_Id(tmdbId)
                    .orElseGet(() -> {

                        RecordEntity entity = RecordEntity.builder()
                                .name(tmdb.getTitle())
                                .type(RecordType.TV_SERIES)
                                .tmdb(tmdb)
                                .build();

                        return recordRepository.save(entity);
                    });

            records.add(record);
        }

        return records;
    }

    /* ======================================================
       ASSIGN TAGS
       ====================================================== */

    private void assignTags(List<RecordEntity> records) {

        int priority = 1;

        for (RecordEntity record : records) {

            if (record.getTags() == null || record.getTags().isEmpty()) {

                RecordTagEntity tag = new RecordTagEntity();
                tag.setRecord(record);
                tag.setTagType(RecordTagType.FEATURED);
                tag.setPriority(priority++);

                record.getTags().add(tag);
            }
        }

        recordRepository.saveAll(records);
    }
}