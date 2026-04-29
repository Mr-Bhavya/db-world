//package com.db.dbworld.services.media;
//
//import com.db.dbworld.entities.dbcinema.DBCinemaRecordsEntity;
//import com.db.dbworld.payloads.mediafile.MediaFileDetails;
//import com.db.dbworld.services.cinema.DBCinemaRecordsService;
//import com.db.dbworld.utils.*;
//import lombok.Getter;
//import lombok.extern.log4j.Log4j2;
//import org.springframework.stereotype.Service;
//import org.springframework.util.StringUtils;
//
//import java.nio.file.Path;
//import java.nio.file.Paths;
//import java.util.List;
//import java.util.Optional;
//import java.util.regex.Matcher;
//import java.util.regex.Pattern;
//
///**
// * @deprecated Superseded by the new app.media.* pipeline.
// * File detail resolution is now handled by MediaInfoService + SymlinkService.
// * Still referenced by old MediaFileHandler until that is removed.
// */
//@Deprecated(forRemoval = true)
//@Log4j2
//@Service
//public class MediaFileUtils {
//
//    /* -------------------- Patterns -------------------- */
//
//    private static final Pattern SEASON_EPISODE_PATTERN = Pattern.compile("S\\d{2}E\\d{2}");
//
//    /* -------------------- Paths -------------------- */
//
//    @Getter
//    private final List<String> allowedBasePaths;
//
//    private static final String MOVIES_FOLDER = "movies";
//    private static final String SERIES_FOLDER = "series";
//
//    /* -------------------- Dependencies -------------------- */
//
//    private final AppProperties runtimeProperties;
//    private final DBCinemaRecordsService dbCinemaRecordsService;
//    private final MediaFileNamingService mediaFileNamingService;
//
//    /* -------------------- Constructor -------------------- */
//
//    public MediaFileUtils(
//            AppProperties runtimeProperties,
//            DBCinemaRecordsService dbCinemaRecordsService,
//            MediaFileNamingService mediaFileNamingService
//    ) {
//        this.runtimeProperties = runtimeProperties;
//        this.dbCinemaRecordsService = dbCinemaRecordsService;
//        this.mediaFileNamingService = mediaFileNamingService;
//
//        this.allowedBasePaths = List.of(
//                cleanPath(runtimeProperties.getTempPath().toString()),
//                cleanPath(runtimeProperties.getIntegrationPath().toString()),
//                cleanPath(runtimeProperties.getStreamPath().toString())
//        );
//    }
//
//    /* -------------------- Public API -------------------- */
//
//    public Optional<MediaFileDetails> createMediaFileDetails(String filePath) {
//
//        if (!StringUtils.hasText(filePath)) {
//            return Optional.empty();
//        }
//
//        String normalized = cleanPath(filePath);
//        Path path = Paths.get(normalized).toAbsolutePath().normalize();
//
//        log.debug("Creating MediaFileDetails for {}", path);
//
//        Optional<DBCinemaRecordsEntity> recordOpt =
//                RecordPathResolver.resolveRecord(
//                        path,
//                        dbCinemaRecordsService::getRecordEntityOptById
//                );
//
//        if (recordOpt.isEmpty()) {
//            log.warn("No record resolved for path {}", path);
//            return Optional.empty();
//        }
//
//        DBCinemaRecordsEntity record = recordOpt.get();
//        Long recordId = record.getId();
//
//        Optional<BaseContext> contextOpt = findBaseContext(path);
//        if (contextOpt.isEmpty()) {
//            log.warn("No base context found for {}", path);
//            return Optional.empty();
//        }
//
//        BaseContext context = contextOpt.get();
//        String seasonEpisode = extractPattern(context.relativePath(), SEASON_EPISODE_PATTERN);
//
//        return seasonEpisode != null
//                ? buildSeriesFileDetails(path, context.baseFolder(), record, seasonEpisode)
//                : buildMovieFileDetails(path, context.baseFolder(), record);
//    }
//
//    /* -------------------- Context Resolution -------------------- */
//
//    private Optional<BaseContext> findBaseContext(Path filePath) {
//
//        for (String baseDir : allowedBasePaths) {
//            Path basePath = Paths.get(baseDir).toAbsolutePath().normalize();
//
//            if (!filePath.startsWith(basePath)) {
//                continue;
//            }
//
//            Path relative = basePath.relativize(filePath);
//            if (relative.getNameCount() == 0) {
//                continue;
//            }
//
//            String baseFolder = PathSanitizer.sanitizePath(relative.getName(0).toString());
//            Path remaining =
//                    relative.getNameCount() > 1
//                            ? relative.subpath(1, relative.getNameCount())
//                            : Path.of("");
//
//            return Optional.of(new BaseContext(
//                    baseDir,
//                    baseFolder,
//                    remaining.toString()
//            ));
//        }
//
//        return Optional.empty();
//    }
//
//    /* -------------------- Builders -------------------- */
//
//    private Optional<MediaFileDetails> buildSeriesFileDetails(
//            Path filePath,
//            String baseFolder,
//            DBCinemaRecordsEntity record,
//            String seasonEpisode
//    ) {
//        try {
//            String season = seasonEpisode.substring(0, 3); // S01
//            String episode = seasonEpisode.substring(3);   // E01
//
//            String streamPath = Paths.get(
//                    cleanPath(runtimeProperties.getStreamPath().toString()),
//                    SERIES_FOLDER,
//                    baseFolder,
//                    season,
//                    filePath.getFileName().toString()
//            ).toString();
//
//            log.info("Series file detected: record={}, season={}, episode={}",
//                    record.getName(), season, episode);
//
//            return Optional.of(new MediaFileDetails(
//                    record,
//                    record.getName(),
//                    mediaFileNamingService.getYearInfo(record),
//                    streamPath,
//                    baseFolder,
//                    AppConstants.RECORD_TYE.SERIES,
//                    record.getId(),
//                    season,
//                    episode,
//                    filePath.getFileName().toString()
//            ));
//        } catch (Exception ex) {
//            log.error("Failed to build series MediaFileDetails for {}", filePath, ex);
//            return Optional.empty();
//        }
//    }
//
//    private Optional<MediaFileDetails> buildMovieFileDetails(
//            Path filePath,
//            String baseFolder,
//            DBCinemaRecordsEntity record
//    ) {
//        try {
//            String streamPath = Paths.get(
//                    cleanPath(runtimeProperties.getStreamPath().toString()),
//                    MOVIES_FOLDER,
//                    baseFolder,
//                    filePath.getFileName().toString()
//            ).toString();
//
//            log.info("Movie file detected: record={}", record.getName());
//
//            return Optional.of(new MediaFileDetails(
//                    record,
//                    record.getName(),
//                    mediaFileNamingService.getYearInfo(record),
//                    streamPath,
//                    baseFolder,
//                    AppConstants.RECORD_TYE.MOVIE,
//                    record.getId(),
//                    null,
//                    null,
//                    filePath.getFileName().toString()
//            ));
//        } catch (Exception ex) {
//            log.error("Failed to build movie MediaFileDetails for {}", filePath, ex);
//            return Optional.empty();
//        }
//    }
//
//    /* -------------------- Helpers -------------------- */
//
//    private String extractPattern(String input, Pattern pattern) {
//        if (!StringUtils.hasText(input)) {
//            return null;
//        }
//        Matcher matcher = pattern.matcher(input);
//        return matcher.find() ? matcher.group() : null;
//    }
//
//    private String cleanPath(String path) {
//        return StringUtils.hasText(path) ? StringUtils.cleanPath(path) : path;
//    }
//
//    /* -------------------- Internal DTO -------------------- */
//
//    private record BaseContext(
//            String baseDirectory,
//            String baseFolder,
//            String relativePath
//    ) {}
//}
