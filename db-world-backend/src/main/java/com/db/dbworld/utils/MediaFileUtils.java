package com.db.dbworld.utils;

import com.db.dbworld.entities.dbcinema.DBCinemaRecordsEntity;
import com.db.dbworld.exceptions.DbWorldException;
import com.db.dbworld.payloads.mediafile.MediaFileDetails;
import com.db.dbworld.services.cinema.DBCinemaRecordsService;
import lombok.Getter;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Log4j2
@Service
public class MediaFileUtils {

    /* -------------------- Patterns -------------------- */

    // Match folder names like "4020-Man vs Baby" (without path separators)
    private static final Pattern RECORD_ID_FOLDER_PATTERN = Pattern.compile("^\\d+-[a-zA-Z0-9 .:'\\-]+$");
    private static final Pattern SEASON_EPISODE_PATTERN = Pattern.compile("S\\d{2}E\\d{2}");

    /* -------------------- Paths -------------------- */

    @Getter
    private final List<String> allowedBasePaths;
    private static final String MOVIES_FOLDER = "movies";
    private static final String SERIES_FOLDER = "series";

    /* -------------------- Dependencies -------------------- */

    private final DbWorldRuntimeProperties runtimeProperties;
    private final DBCinemaRecordsService dbCinemaRecordsService;
    private final MediaInfoUtils mediaInfoUtils;

    /* -------------------- Constructor -------------------- */

    public MediaFileUtils(
            DbWorldRuntimeProperties runtimeProperties,
            DBCinemaRecordsService dbCinemaRecordsService,
            MediaInfoUtils mediaInfoUtils
    ) {
        this.runtimeProperties = runtimeProperties;
        this.dbCinemaRecordsService = dbCinemaRecordsService;
        this.mediaInfoUtils = mediaInfoUtils;

        // Initialize allowedBasePaths with cleaned paths
        this.allowedBasePaths = List.of(
                cleanPath(runtimeProperties.getTempPath().toString()),
                cleanPath(runtimeProperties.getIntegrationPath().toString())
        );
    }

    /* -------------------- Public API -------------------- */

    public Optional<MediaFileDetails> createMediaFileDetails(String filePath) {
        String normalizedPath = cleanPath(filePath);
        log.debug("Creating MediaFileDetails for: {}", normalizedPath);

        Path path = Paths.get(normalizedPath);

        Optional<BaseContext> contextOpt = findBaseContext(normalizedPath);
        if (contextOpt.isEmpty()) {
            log.warn("Could not find base context for path: {}", normalizedPath);
            return Optional.empty();
        }

        BaseContext context = contextOpt.get();
        String baseFolder = context.baseFolder();
        String seasonEpisode = extractPattern(context.relativePath(), SEASON_EPISODE_PATTERN);

        Long recordId = parseRecordId(baseFolder);

        log.debug("Found context - baseFolder: {}, recordId: {}, seasonEpisode: {}",
                baseFolder, recordId, seasonEpisode);

        return seasonEpisode != null
                ? buildSeriesFileDetails(path, baseFolder, recordId, seasonEpisode)
                : buildMovieFileDetails(path, baseFolder, recordId);
    }

    /* -------------------- Core Logic -------------------- */

    private Optional<BaseContext> findBaseContext(String normalizedPath) {
        Path filePath = Paths.get(normalizedPath).toAbsolutePath().normalize();

        log.debug("Finding base context for absolute path: {}", filePath);

        for (String baseDir : allowedBasePaths) {
            Path basePath = Paths.get(baseDir).toAbsolutePath().normalize();

            log.debug("Checking against base path: {}", basePath);

            if (!filePath.startsWith(basePath)) {
                continue;
            }

            Path relativePath = basePath.relativize(filePath);
            log.debug("Relative path: {}", relativePath);

            // Find the first directory that matches our pattern
            // Skip the last element (filename) and check directories
            int nameCount = relativePath.getNameCount();
            for (int i = 0; i < nameCount - 1; i++) {
                Path segment = relativePath.getName(i);
                String segmentStr = segment.toString();

                log.debug("Checking segment {}: '{}'", i, segmentStr);

                if (RECORD_ID_FOLDER_PATTERN.matcher(segmentStr).matches()) {
                    // Get remaining path after the base folder
                    Path remainingPath = relativePath.subpath(i + 1, nameCount);

                    log.debug("Found base folder: '{}', remaining path: '{}'",
                            segmentStr, remainingPath);

                    return Optional.of(new BaseContext(
                            baseDir,
                            PathSanitizer.sanitizePath(segmentStr),
                            remainingPath.toString()
                    ));
                }
            }

            log.debug("No matching pattern found in path segments");
        }

        log.debug("No base context found for path: {}", normalizedPath);
        return Optional.empty();
    }

    private String extractPattern(String input, Pattern pattern) {
        if (input == null || input.isEmpty()) {
            return null;
        }
        Matcher matcher = pattern.matcher(input);
        return matcher.find() ? matcher.group() : null;
    }

    public Long parseRecordId(String folderName) {
        try {
            return Long.parseLong(folderName.split("-")[0]);
        } catch (Exception e) {
            throw new DbWorldException(
                    "Invalid folder name format, unable to parse recordId: " + folderName, e
            );
        }
    }

    /* -------------------- Builders -------------------- */

    private Optional<MediaFileDetails> buildSeriesFileDetails(
            Path filePath,
            String baseFolder,
            Long recordId,
            String seasonEpisode
    ) {
        try {
            String season = seasonEpisode.substring(0, 3); // S01
            String episode = seasonEpisode.substring(3);   // E01

            String streamFilePath = Paths.get(
                    cleanPath(runtimeProperties.getStreamPath().toString()),
                    SERIES_FOLDER,
                    baseFolder,
                    season,
                    filePath.getFileName().toString()
            ).toString();

            DBCinemaRecordsEntity record = dbCinemaRecordsService.getRecordEntityById(recordId);

            log.info("Building series file details - Record: {}, Season: {}, Episode: {}",
                    record.getName(), season, episode);

            return Optional.of(new MediaFileDetails(
                    record,
                    record.getName(),
                    mediaInfoUtils.getYearInfo(record),
                    streamFilePath,
                    baseFolder,
                    DbWorldConstants.RECORD_TYE.SERIES,
                    recordId,
                    season,
                    episode
            ));
        } catch (Exception e) {
            log.error("Error building series file details for recordId: {}", recordId, e);
            return Optional.empty();
        }
    }

    private Optional<MediaFileDetails> buildMovieFileDetails(
            Path filePath,
            String baseFolder,
            Long recordId
    ) {
        try {
            String streamFilePath = Paths.get(
                    cleanPath(runtimeProperties.getStreamPath().toString()),
                    MOVIES_FOLDER,
                    baseFolder,
                    filePath.getFileName().toString()
            ).toString();

            DBCinemaRecordsEntity record = dbCinemaRecordsService.getRecordEntityById(recordId);

            log.info("Building movie file details - Record: {}", record.getName());

            return Optional.of(new MediaFileDetails(
                    record,
                    record.getName(),
                    mediaInfoUtils.getYearInfo(record),
                    streamFilePath,
                    baseFolder,
                    DbWorldConstants.RECORD_TYE.MOVIE,
                    recordId,
                    null,
                    null
            ));
        } catch (Exception e) {
            log.error("Error building movie file details for recordId: {}", recordId, e);
            return Optional.empty();
        }
    }

    /* -------------------- Helper Methods -------------------- */

    /**
     * Wrapper around StringUtils.cleanPath for consistent path cleaning
     */
    private String cleanPath(String path) {
        if (path == null || path.isEmpty()) {
            return path;
        }
        return StringUtils.cleanPath(path);
    }

    /* -------------------- Internal DTO -------------------- */

    private record BaseContext(
            String baseDirectory,
            String baseFolder,
            String relativePath
    ) {}
}