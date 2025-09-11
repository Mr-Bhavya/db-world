package com.db.dbworld.handler;

import com.db.dbworld.dao.dbcinema.tmdb.SpokenLanguageRepository;
import com.db.dbworld.entities.dbcinema.DBCinemaRecordsEntity;
import com.db.dbworld.entities.dbcinema.stream.AudioInfoEntity;
import com.db.dbworld.entities.dbcinema.stream.MediaFileInfoEntity;
import com.db.dbworld.entities.dbcinema.stream.VideoInfoEntity;
import com.db.dbworld.entities.dbcinema.tmdb.MovieTmdbDataEntity;
import com.db.dbworld.entities.dbcinema.tmdb.SpokenLanguageEntity;
import com.db.dbworld.exceptions.DbWorldException;
import com.db.dbworld.services.cinema.DBCinemaRecordsService;
import com.db.dbworld.services.media.MediaFileInfoService;
import com.db.dbworld.utils.DbWorldConstants;
import com.db.dbworld.utils.DbWorldUtils;
import com.db.dbworld.utils.PathSanitizer;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.gson.Gson;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Log4j2
@Service("mediaFileHandler")
public class MediaFileHandler {

    @Autowired
    private MediaFileInfoService mediaFileInfoService;

    @Autowired
    private DBCinemaRecordsService dbCinemaRecordsService;

    @Autowired
    private DbWorldUtils dbWorldUtils;

    @Autowired
    private SpokenLanguageRepository spokenLanguageRepository;

    @Autowired
    private PathSanitizer pathSanitizer;

    private static final String MOVIES_FOLDER = "movies";
    private static final String SERIES_FOLDER = "series";
    private static final String UNASSIGNED_FOLDER = "unassigned";

    private static final Pattern SEASON_EPISODE_PATTERN = Pattern.compile("([sS]\\d{2}[eE]\\d{2})");
    private static final Pattern BASE_FOLDER_PATTERN = Pattern.compile("\\d+-[a-zA-Z0-9 .:'\\-]+");
    private static final Pattern SEASON_EPISODE_EXTRACT_PATTERN = Pattern.compile("S\\d{2}E\\d{2}");

    private final ObjectMapper objectMapper;

    public MediaFileHandler() {
        this.objectMapper = new ObjectMapper();
        objectMapper.configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
    }

    private record FileDetails(
            String streamFilePath,
            String recordIdFolder,
            String recordType,
            Long recordId,
            String season,
            String episode
    ) {
    }

    public void processFile(File file) {
        try {
            Path path = file.toPath();
            boolean isUnassigned = path.toString().contains(UNASSIGNED_FOLDER);

            if (isUnassigned) {
                processUnassignedFile(file);
            } else {
                processAssignedFile(file);
            }
        } catch (Exception e) {
            log.error("Error processing file: {}, {}", file, e.getLocalizedMessage());
        }
    }

    private void processUnassignedFile(File file) {
        try {
            String sourceFile = file.getPath();
            Path sourceFilePath = file.toPath();

            if (!file.exists()) {
                log.info("File not found, skipping: {}", file.getAbsolutePath());
                return;
            }

            String relativePath = extractRelativePathAfterUnassigned(sourceFile);
            String seasonEpisode = extractSeasonEpisode(relativePath);

            String targetPath = buildUnassignedTargetPath(sourceFilePath, relativePath, seasonEpisode);
            dbWorldUtils.moveFileOrDir(sourceFile, targetPath, true);
            log.info("Moved unassigned file from {} to {}", sourceFile, targetPath);
        } catch (Exception e) {
            log.error("Error processing unassigned file: {}, {}", file, e.getLocalizedMessage());
        }
    }

    private String extractRelativePathAfterUnassigned(String sourceFile) {
        String relativePath = sourceFile.substring(sourceFile.indexOf(UNASSIGNED_FOLDER) + UNASSIGNED_FOLDER.length() + 1);
        return normalizePath(relativePath);
    }

    private String buildUnassignedTargetPath(Path sourceFilePath, String relativePath, String seasonEpisode) {
        if (seasonEpisode != null) {
            String seriesName = extractSeriesName(relativePath);
            String season = seasonEpisode.substring(0, 3);
            return String.format("%s/%s/%s/%s/%s",
                    normalizePath(DbWorldConstants.STREAM_HOME_PATH),
                    UNASSIGNED_FOLDER,
                    seriesName,
                    season,
                    sourceFilePath.getFileName().toString());
        } else {
            return String.format("%s/%s/%s",
                    normalizePath(DbWorldConstants.STREAM_HOME_PATH),
                    UNASSIGNED_FOLDER,
                    sourceFilePath.getFileName().toString());
        }
    }

    private String extractSeasonEpisode(String path) {
        Matcher matcher = SEASON_EPISODE_PATTERN.matcher(path);
        return matcher.find() ? matcher.group().toUpperCase() : null;
    }

    private String extractSeriesName(String path) {
        path = normalizePath(path);
        int seasonIndex = path.toLowerCase().indexOf("s0");
        if (seasonIndex == -1) return "Unknown";

        String[] parts = path.substring(0, seasonIndex).split("/");
        String seriesName = parts[parts.length - 1];
        return seriesName.replaceAll("[^a-zA-Z0-9 .'-]", "");
    }

    private void processAssignedFile(File file) {
        try {
            FileDetails fileDetails = extractBaseFolder(file.getPath())
                    .orElseThrow(() -> new DbWorldException("Unable to retrieve recordId from folder path: " + file.getPath()));

            if (file.exists()) {
                processExistingAssignedFile(file, fileDetails);
            } else {
                handleFileDeletion(file.getAbsolutePath());
            }
        } catch (Exception e) {
            log.error("Error processing assigned file: {}, {}", file, e.getLocalizedMessage());
        }
    }

    private void processExistingAssignedFile(File file, FileDetails fileDetails) {
        String sourcePath = file.getPath();
        List<MediaFileInfoEntity> mediaFileInfoEntities = getMediaFileInfo(fileDetails, file.toPath());

        mediaFileInfoEntities.forEach(mediaFileInfoEntity -> {
            mediaFileInfoService.save(mediaFileInfoEntity);
            dbWorldUtils.moveFileOrDir(sourcePath, mediaFileInfoEntity.getFilePath(), true);
        });

        log.info("Processed {} files for recordId: {}", mediaFileInfoEntities.size(), fileDetails.recordId);
    }

    private Optional<FileDetails> extractBaseFolder(String filePath) {
        String normalizedPath = normalizePath(filePath);
        Path path = Paths.get(normalizedPath);
        String baseDirectory = normalizePath(DbWorldConstants.INTEGRATION_FOLDER_PATH);

        if (!normalizedPath.startsWith(baseDirectory)) {
            return Optional.empty();
        }

        String relativePath = normalizedPath.substring(baseDirectory.length());
        String baseFolder = extractPattern(relativePath, BASE_FOLDER_PATTERN);
        String seasonEpisode = extractPattern(relativePath, SEASON_EPISODE_EXTRACT_PATTERN);

        if (baseFolder != null) {
            String processedBaseFolder = pathSanitizer.sanitizePath(baseFolder);
            Long recordId = parseRecordId(processedBaseFolder);

            if (seasonEpisode != null) {
                return buildSeriesFileDetails(path, processedBaseFolder, recordId, seasonEpisode);
            } else {
                return buildMovieFileDetails(path, processedBaseFolder, recordId);
            }
        }

        return Optional.empty();
    }

    private String extractPattern(String input, Pattern pattern) {
        Matcher matcher = pattern.matcher(input);
        return matcher.find() ? matcher.group() : null;
    }

    private Optional<FileDetails> buildSeriesFileDetails(Path filePath, String baseFolder, Long recordId, String seasonEpisode) {
        String season = seasonEpisode.substring(0, 3);
        String episode = seasonEpisode.substring(3);
        String streamFilePath = String.format("%s/%s/%s/%s/%s",
                normalizePath(DbWorldConstants.STREAM_HOME_PATH),
                SERIES_FOLDER,
                baseFolder,
                season,
                filePath.getFileName().toString());

        return Optional.of(new FileDetails(
                streamFilePath, baseFolder, DbWorldConstants.RECORD_TYPE_SERIES, recordId, season, episode
        ));
    }

    private Optional<FileDetails> buildMovieFileDetails(Path filePath, String baseFolder, Long recordId) {
        String streamFilePath = String.format("%s/%s/%s/%s",
                normalizePath(DbWorldConstants.STREAM_HOME_PATH),
                MOVIES_FOLDER,
                baseFolder,
                filePath.getFileName().toString());

        return Optional.of(new FileDetails(
                streamFilePath, baseFolder, DbWorldConstants.RECORD_TYPE_MOVIE, recordId, null, null
        ));
    }

    private Long parseRecordId(String folderName) {
        try {
            return Long.parseLong(folderName.split("-")[0]);
        } catch (NumberFormatException e) {
            throw new DbWorldException("Invalid folder name format, unable to parse recordId: " + folderName, e);
        }
    }

    private void handleFileDeletion(String filePath) {
        try {
            mediaFileInfoService.deleteInfoByFilePath(filePath);
            log.info("File deleted from database: {}", filePath);
        } catch (Exception e) {
            log.error("Error deleting file from database: {}", filePath, e);
        }
    }

    private List<MediaFileInfoEntity> getMediaFileInfo(FileDetails fileDetails, Path sourcePath) {
        try {
            String jsonOutput = dbWorldUtils.runMediaInfoCommand(sourcePath);
            return parseMediaInfoJson(fileDetails, jsonOutput);
        } catch (Exception e) {
            throw new DbWorldException("Error storing media info for recordId: " + fileDetails.recordId, e);
        }
    }

    private List<MediaFileInfoEntity> parseMediaInfoJson(FileDetails fileDetails, String jsonOutput) {
        try {
            JsonElement jsonElement = new Gson().fromJson(jsonOutput, JsonElement.class);
            List<MediaFileInfoEntity> mediaFileInfos = new ArrayList<>();

            if (jsonElement.isJsonArray()) {
                jsonElement.getAsJsonArray().forEach(element ->
                        mediaFileInfos.add(jsonObjectToMediaFileInfoEntity(fileDetails, element.getAsJsonObject())));
            } else if (jsonElement.isJsonObject()) {
                mediaFileInfos.add(jsonObjectToMediaFileInfoEntity(fileDetails, jsonElement.getAsJsonObject()));
            }

            return mediaFileInfos;
        } catch (Exception ex) {
            throw new DbWorldException("Error parsing media info JSON", ex);
        }
    }

    private MediaFileInfoEntity jsonObjectToMediaFileInfoEntity(FileDetails fileDetails, JsonObject jsonObject) {
        try {
            MediaFileInfoEntity entity = convertJsonObjectToMediaInfo(jsonObject);

            if (fileDetails.recordId != null) {
                DBCinemaRecordsEntity dbCinemaRecordsEntity = dbCinemaRecordsService.getRecordEntityById(fileDetails.recordId);
                entity = entity.initialize(dbCinemaRecordsEntity);
                buildFileNameAndPath(fileDetails, entity, dbCinemaRecordsEntity);
            }

            return entity;
        } catch (Exception e) {
            log.error("Error parsing media info JSON for recordId: {}, {}", fileDetails.recordId, e.getMessage());
            throw new DbWorldException("Error parsing media info JSON for recordId: " + fileDetails.recordId, e);
        }
    }

    private void buildFileNameAndPath(FileDetails fileDetails, MediaFileInfoEntity entity, DBCinemaRecordsEntity dbCinemaRecordsEntity) {
        StringBuilder fileNameBuilder = new StringBuilder();
        String recordType = dbCinemaRecordsEntity.getType();

        if (DbWorldConstants.RECORD_TYPE_MOVIE.equalsIgnoreCase(recordType)) {
            buildMovieFileName(fileNameBuilder, dbCinemaRecordsEntity, entity);
        } else if (DbWorldConstants.RECORD_TYPE_SERIES.equalsIgnoreCase(recordType)) {
            buildSeriesFileName(fileDetails, fileNameBuilder, dbCinemaRecordsEntity, entity);
        }

        appendFileExtension(fileNameBuilder, fileDetails);
        String sanitizeFileName = pathSanitizer.sanitizeFilename(fileNameBuilder.toString());
        entity.setFileName(sanitizeFileName);
        entity.setFilePath(Path.of(Path.of(fileDetails.streamFilePath).getParent().toString(), sanitizeFileName).toString());
    }

    private void buildMovieFileName(StringBuilder fileNameBuilder, DBCinemaRecordsEntity dbCinemaRecordsEntity, MediaFileInfoEntity entity) {
        fileNameBuilder.append(dbCinemaRecordsEntity.getName());
        appendVideoInfo(fileNameBuilder, entity, dbCinemaRecordsEntity);
        appendAudioInfo(fileNameBuilder, entity);
    }

    private void buildSeriesFileName(FileDetails fileDetails, StringBuilder fileNameBuilder, DBCinemaRecordsEntity dbCinemaRecordsEntity,
                                     MediaFileInfoEntity entity) {
        fileNameBuilder.append(dbCinemaRecordsEntity.getName())
                .append(" ").append(fileDetails.season).append(fileDetails.episode);
        appendVideoInfo(fileNameBuilder, entity, null);
        appendAudioInfo(fileNameBuilder, entity);
    }

    private void appendVideoInfo(StringBuilder fileNameBuilder, MediaFileInfoEntity entity, DBCinemaRecordsEntity dbCinemaRecordsEntity) {

        // Add year for movies
        if (dbCinemaRecordsEntity != null && dbCinemaRecordsEntity.getTmdb() instanceof MovieTmdbDataEntity) {
            appendMovieYear(fileNameBuilder, (MovieTmdbDataEntity) dbCinemaRecordsEntity.getTmdb());
        }

        Optional<VideoInfoEntity> videoInfoOpt = getFirstVideoTrack(entity);

        if (videoInfoOpt.isPresent()) {
            VideoInfoEntity videoInfo = videoInfoOpt.get();

            // Add resolution
            fileNameBuilder.append(" [").append(videoInfo.getHeight()).append("p]");

            // Add HDR info
            appendHdrInfo(fileNameBuilder, videoInfo);
        }
    }

    private Optional<VideoInfoEntity> getFirstVideoTrack(MediaFileInfoEntity entity) {
        return entity.getTrackInfos().stream()
                .filter(VideoInfoEntity.class::isInstance)
                .map(VideoInfoEntity.class::cast)
                .findFirst();
    }

    private void appendMovieYear(StringBuilder fileNameBuilder, MovieTmdbDataEntity movieTmdbData) {
        if (movieTmdbData.getRelease_date() != null && movieTmdbData.getRelease_date().length() >= 4) {
            String year = movieTmdbData.getRelease_date().substring(0, 4);
            fileNameBuilder.append(" (").append(year).append(")");
        }
    }

    private void appendHdrInfo(StringBuilder fileNameBuilder, VideoInfoEntity videoInfo) {
        String hdr = videoInfo.getHdrFormat();
        if (hdr != null && !hdr.isBlank()) {
            if (hdr.contains("Dolby Vision")) {
                fileNameBuilder.append(" [DV HDR]");
            } else if (hdr.contains("HDR10")) {
                fileNameBuilder.append(" [HDR10]");
            } else if (hdr.contains("HLG")) {
                fileNameBuilder.append(" [HLG]");
            } else {
                fileNameBuilder.append(" [").append(hdr).append("]");
            }
        }
    }

    private void appendAudioInfo(StringBuilder fileNameBuilder, MediaFileInfoEntity entity) {
        List<AudioInfoEntity> audioTracks = getAudioTracks(entity);

        if (!audioTracks.isEmpty()) {
            if (audioTracks.size() == 1) {
                fileNameBuilder.append(" [").append(formatAudioInfo(audioTracks.get(0))).append("]");
            } else if (audioTracks.size() == 2) {
                fileNameBuilder.append(" [").append(formatAudioInfo(audioTracks.get(0))).append(" + ").append(formatAudioInfo(audioTracks.get(1))).append("]");
            } else {
                fileNameBuilder.append(" [MULTI]");
            }
        }
    }

    private List<AudioInfoEntity> getAudioTracks(MediaFileInfoEntity entity) {
        return entity.getTrackInfos().stream()
                .filter(AudioInfoEntity.class::isInstance)
                .map(AudioInfoEntity.class::cast)
                .collect(Collectors.toList());
    }

    private void appendFileExtension(StringBuilder fileNameBuilder, FileDetails fileDetails) {
        String originalFileName = fileDetails.streamFilePath;
        if (originalFileName != null && originalFileName.contains(".")) {
            String extension = originalFileName.substring(originalFileName.lastIndexOf('.'));
            fileNameBuilder.append(extension);
        }
    }

    private String formatAudioInfo(AudioInfoEntity audio) {
        StringBuilder audioBuilder = new StringBuilder();

        // Format
        String format = audio.getFormat();
        if (format.contains("AC-3") || format.contains("Dolby Digital")) {
            audioBuilder.append("DDP");
        } else if (format.contains("DTS")) {
            audioBuilder.append("DTS");
        } else if (format.contains("AAC")) {
            audioBuilder.append("AAC");
        } else if (format.contains("TrueHD")) {
            audioBuilder.append("TrueHD");
        } else {
            audioBuilder.append(format);
        }

        // Channels
        Integer channels = audio.getChannels();
        if (channels != null) {
            audioBuilder.append(" ");
            switch (channels) {
                case 2:
                    audioBuilder.append("2.0");
                    break;
                case 6:
                    audioBuilder.append("5.1");
                    break;
                case 8:
                    audioBuilder.append("7.1");
                    break;
                default:
                    audioBuilder.append(channels).append("ch");
            }
        }

        // Language
        String language = audio.getLanguage();
        if (language != null && !language.isBlank() && !"und".equals(language)) {
            spokenLanguageRepository.findById(language).ifPresentOrElse(
                    spokenLanguageEntity -> {
                        if(spokenLanguageEntity.getName() != null && !spokenLanguageEntity.getName().isBlank()){
                            audioBuilder.append(" ").append(spokenLanguageEntity.getName());
                        }else{
                            audioBuilder.append(" ").append(spokenLanguageEntity.getEnglish_name());
                        }
                    }, () -> audioBuilder.append(" ").append(language.toUpperCase())
            );
        }
        return audioBuilder.toString();
    }

    private MediaFileInfoEntity convertJsonObjectToMediaInfo(JsonObject jsonObject) throws JsonProcessingException {
        MediaFileInfoEntity mediaFileInfo = objectMapper.readValue(jsonObject.get("media").toString(), MediaFileInfoEntity.class);
        if (mediaFileInfo == null) {
            throw new DbWorldException("Media file details could not be retrieved from JSON");
        }
        return mediaFileInfo;
    }

    private String normalizePath(String path) {
        return path.replace("\\", "/");
    }

    private String createFolderName(String originalName) {
        // Replace ": " with "- "
        String safeName = originalName.replace(": ", "- ");
        // Replace other restricted characters with "-"
        return safeName.replaceAll("[:*?\"<>|\\\\/]", "-");
    }
}