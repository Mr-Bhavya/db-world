package com.db.dbworld.handler;

import com.db.dbworld.dao.dbcinema.tmdb.SpokenLanguageRepository;
import com.db.dbworld.entities.dbcinema.DBCinemaRecordsEntity;
import com.db.dbworld.entities.dbcinema.stream.*;
import com.db.dbworld.entities.dbcinema.tmdb.MovieTmdbDataEntity;
import com.db.dbworld.entities.dbcinema.tmdb.SeriesTmdbDataEntity;
import com.db.dbworld.entities.dbcinema.tmdb.SpokenLanguageEntity;
import com.db.dbworld.exceptions.DbWorldException;
import com.db.dbworld.payloads.mediafile.MediaFileDetails;
import com.db.dbworld.services.cinema.DBCinemaRecordsService;
import com.db.dbworld.services.media.MediaFileInfoService;
import com.db.dbworld.services.media.MediaInfoCommandService;
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

    @Autowired
    private MediaInfoCommandService mediaInfoCommandService;

    private static final String MOVIES_FOLDER = "movies";
    private static final String SERIES_FOLDER = "series";
    private static final String UNASSIGNED_FOLDER = "unassigned";
    private static final Map<String, String> FORMAT_EXTENSION_MAP = Map.ofEntries(
            Map.entry("mpeg-4", ".mp4"),
            Map.entry("mpeg4", ".mp4"),
            Map.entry("mpeg-2", ".mpg"),
            Map.entry("mpeg2", ".mpg"),
            Map.entry("webm", ".webm"),
            Map.entry("wmv", ".wmv"),
            Map.entry("windows media", ".wmv"),
            Map.entry("quicktime", ".mov"),
            Map.entry("flash video", ".flv"),
            Map.entry("matroska", ".mkv"),
            Map.entry("avi", ".avi"));

    private static final Pattern SEASON_EPISODE_PATTERN = Pattern.compile("([sS]\\d{2}[eE]\\d{2})");
    private static final Pattern BASE_FOLDER_PATTERN = Pattern.compile("\\d+-[a-zA-Z0-9 .:'\\-]+");
    private static final Pattern SEASON_EPISODE_EXTRACT_PATTERN = Pattern.compile("S\\d{2}E\\d{2}");

    private final ObjectMapper objectMapper;

    public MediaFileHandler() {
        this.objectMapper = new ObjectMapper();
        objectMapper.configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
    }

//    private record FileDetails(
//            String streamFilePath,
//            String recordIdFolder,
//            String recordType,
//            Long recordId,
//            String season,
//            String episode
//    ) {
//    }

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
            MediaFileDetails fileDetails = extractBaseFolder(file.getPath())
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

    private void processExistingAssignedFile(File file, MediaFileDetails fileDetails) {
        String sourcePath = file.getPath();
        List<MediaFileInfoEntity> mediaFileInfoEntities = getMediaFileInfo(fileDetails, file.toPath());

        mediaFileInfoEntities.forEach(mediaFileInfoEntity -> {
            mediaFileInfoService.save(mediaFileInfoEntity);
            dbWorldUtils.moveFileOrDir(sourcePath, mediaFileInfoEntity.getFilePath(), true);
        });

        log.info("Processed {} files for recordId: {}", mediaFileInfoEntities.size(), fileDetails.getRecordId());
    }

    private Optional<MediaFileDetails> extractBaseFolder(String filePath) {
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

    private Optional<MediaFileDetails> buildSeriesFileDetails(Path filePath, String baseFolder, Long recordId, String seasonEpisode) {
        String season = seasonEpisode.substring(0, 3);
        String episode = seasonEpisode.substring(3);
        String streamFilePath = String.format("%s/%s/%s/%s/%s",
                normalizePath(DbWorldConstants.STREAM_HOME_PATH),
                SERIES_FOLDER,
                baseFolder,
                season,
                filePath.getFileName().toString());

        DBCinemaRecordsEntity dbCinemaRecordsEntity = dbCinemaRecordsService.getRecordEntityById(recordId);

        return Optional.of(new MediaFileDetails( dbCinemaRecordsEntity,
                dbCinemaRecordsEntity.getName(), getYearInfo(dbCinemaRecordsEntity),
                streamFilePath, baseFolder, DbWorldConstants.RECORD_TYPE_SERIES, recordId, season, episode
        ));
    }

    private Optional<MediaFileDetails> buildMovieFileDetails(Path filePath, String baseFolder, Long recordId) {
        String streamFilePath = String.format("%s/%s/%s/%s",
                normalizePath(DbWorldConstants.STREAM_HOME_PATH),
                MOVIES_FOLDER,
                baseFolder,
                filePath.getFileName().toString());

        DBCinemaRecordsEntity dbCinemaRecordsEntity = dbCinemaRecordsService.getRecordEntityById(recordId);

        return Optional.of(new MediaFileDetails( dbCinemaRecordsEntity,
                dbCinemaRecordsEntity.getName(), getYearInfo(dbCinemaRecordsEntity),
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

    private List<MediaFileInfoEntity> getMediaFileInfo(MediaFileDetails fileDetails, Path sourcePath) {
        try {
            String jsonOutput = mediaInfoCommandService.runMediaInfoCommand(sourcePath, true, fileDetails);
            return parseMediaInfoJson(fileDetails, jsonOutput);
        } catch (Exception e) {
            throw new DbWorldException("Error storing media info for recordId: " + fileDetails.getRecordId(), e);
        }
    }

    private List<MediaFileInfoEntity> parseMediaInfoJson(MediaFileDetails fileDetails, String jsonOutput) {
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

    private MediaFileInfoEntity jsonObjectToMediaFileInfoEntity(MediaFileDetails fileDetails, JsonObject jsonObject) {
        try {
            MediaFileInfoEntity entity = convertJsonObjectToMediaInfo(jsonObject);

            if (fileDetails.getRecordId() != null) {
                entity = entity.initialize(fileDetails.getDbCinemaRecordsEntity());
                buildFileNameAndPath(fileDetails, entity, fileDetails.getDbCinemaRecordsEntity());
            }

            return entity;
        } catch (Exception e) {
            log.error("Error parsing media info JSON for recordId: {}, {}", fileDetails.getRecordId(), e.getMessage());
            throw new DbWorldException("Error parsing media info JSON for recordId: " + fileDetails.getRecordId(), e);
        }
    }

    private void buildFileNameAndPath(MediaFileDetails fileDetails, MediaFileInfoEntity entity, DBCinemaRecordsEntity dbCinemaRecordsEntity) {
        StringBuilder fileNameBuilder = new StringBuilder();
        String recordType = dbCinemaRecordsEntity.getType();

        if (DbWorldConstants.RECORD_TYPE_MOVIE.equalsIgnoreCase(recordType)) {
            buildMovieFileName(fileNameBuilder, fileDetails, entity);
        } else if (DbWorldConstants.RECORD_TYPE_SERIES.equalsIgnoreCase(recordType)) {
            buildSeriesFileName(fileDetails, fileNameBuilder, entity);
        }

        appendFileExtension(fileNameBuilder, fileDetails, entity);
        String sanitizeFileName = pathSanitizer.sanitizeFilename(fileNameBuilder.toString());
        entity.setFileName(sanitizeFileName);
        entity.setFilePath(Path.of(Path.of(fileDetails.getStreamFilePath()).getParent().toString(), sanitizeFileName).toString());
    }

    private void buildMovieFileName(StringBuilder fileNameBuilder, MediaFileDetails fileDetails, MediaFileInfoEntity entity) {
        fileNameBuilder.append(fileDetails.getName());
        appendVideoInfo(fileNameBuilder, entity, fileDetails);
        appendAudioInfo(fileNameBuilder, entity);
    }

    private void buildSeriesFileName(MediaFileDetails fileDetails, StringBuilder fileNameBuilder,
                                     MediaFileInfoEntity entity) {
        fileNameBuilder.append(fileDetails.getName())
                .append(" ").append(fileDetails.getSeason()).append(fileDetails.getEpisode());
        appendVideoInfo(fileNameBuilder, entity, fileDetails);
        appendAudioInfo(fileNameBuilder, entity);
    }

    private void appendVideoInfo(StringBuilder fileNameBuilder, MediaFileInfoEntity entity, MediaFileDetails fileDetails) {

        fileNameBuilder.append(" (").append(fileDetails.getYear()).append(")");

        Optional<VideoInfoEntity> videoInfoOpt = getFirstVideoTrack(entity);

        if (videoInfoOpt.isPresent()) {
            VideoInfoEntity videoInfo = videoInfoOpt.get();

            // Add resolution
            appendResolutionInfo(fileNameBuilder, videoInfo);

            // Convert format codes to more readable names
            appendCodecInfo(fileNameBuilder, videoInfo);

            // Add bit depth info from format profile
            appendBitInfo(fileNameBuilder, videoInfo);

            // Add HDR info
            appendHdrInfo(fileNameBuilder, videoInfo);
        }
    }

    private String getYearInfo(DBCinemaRecordsEntity dbCinemaRecordsEntity) {
        if (dbCinemaRecordsEntity != null && dbCinemaRecordsEntity.getTmdb() != null) {
            if (dbCinemaRecordsEntity.getTmdb() instanceof MovieTmdbDataEntity movieTmdbData) {
                if (movieTmdbData.getRelease_date() != null && movieTmdbData.getRelease_date().length() >= 4) {
                    return movieTmdbData.getRelease_date().substring(0, 4);
                }
            } else if (dbCinemaRecordsEntity.getTmdb() instanceof SeriesTmdbDataEntity tvTmdbData) {
                if (tvTmdbData.getFirst_air_date() != null && tvTmdbData.getFirst_air_date().length() >= 4) {
                    return tvTmdbData.getFirst_air_date().substring(0, 4);
                }
            }
        }
        return "";
    }

    private void appendBitInfo(StringBuilder fileNameBuilder, VideoInfoEntity videoInfo){
        Integer bitDepth = videoInfo.getBitDepth();
        if (bitDepth != null) {
            if (bitDepth == 10) {
                fileNameBuilder.append(" [10Bit]");
            }else if (bitDepth == 12) {
                fileNameBuilder.append(" [12Bit]");
            } else if (bitDepth == 8) {
                fileNameBuilder.append(" [8Bit]");
            }
        }
    }

    private void appendResolutionInfo(StringBuilder fileNameBuilder, VideoInfoEntity videoInfo){
        int height = videoInfo.getHeight();
        String resolution;
        if (height > 2160) {
            resolution = "4320p"; // 8K (anything above 4K)
        } else if (height > 1080) {
            resolution = "2160p"; // 4K (1081-2160)
        } else if (height > 720) {
            resolution = "1080p"; // Full HD (721-1080)
        } else if (height > 480) {
            resolution = "720p"; // HD (481-720)
        } else if (height > 360) {
            resolution = "480p"; // SD (361-480)
        } else {
            resolution = "360p"; // Low quality (360 and below)
        }
        fileNameBuilder.append(" [").append(resolution).append("]");
    }

    private void appendCodecInfo(StringBuilder fileNameBuilder, VideoInfoEntity videoInfo){
        String format = videoInfo.getFormat().toUpperCase();
        String formatDisplayName = switch (format) {
            case "HEVC" -> "H265";
            case "AVC" -> "H264";
            case "AV1" -> "AV1";
            default -> format;
        };
        fileNameBuilder.append(" [").append(formatDisplayName).append("]");
    }

    private Optional<VideoInfoEntity> getFirstVideoTrack(MediaFileInfoEntity entity) {
        return entity.getTrackInfos().stream()
                .filter(VideoInfoEntity.class::isInstance)
                .map(VideoInfoEntity.class::cast)
                .findFirst();
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

    private void appendFileExtension(StringBuilder fileNameBuilder, MediaFileDetails fileDetails, MediaFileInfoEntity mediaFileInfo) {
        Optional.ofNullable(mediaFileInfo)
                .flatMap(this::getExtensionFromMediaFileInfo)
                .or(() -> Optional.ofNullable(fileDetails)
                        .map(MediaFileDetails::getStreamFilePath)
                        .flatMap(this::getExtensionFromFileName))
                .ifPresent(fileNameBuilder::append);
    }

    private Optional<String> getExtensionFromMediaFileInfo(MediaFileInfoEntity mediaFileInfo) {
        return Optional.ofNullable(mediaFileInfo)
                .map(MediaFileInfoEntity::getTrackInfos)
                .stream()
                .flatMap(Collection::stream)
                .filter(GeneralInfoEntity.class::isInstance)
                .map(GeneralInfoEntity.class::cast)
                .findFirst()
                .map(GeneralInfoEntity::getFormat)
                .flatMap(this::getExtensionFromFormat);
    }

    private Optional<String> getExtensionFromFileName(String fileName) {
        return Optional.ofNullable(fileName)
                .filter(name -> name.contains("."))
                .map(name -> {
                    int lastDotIndex = name.lastIndexOf('.');
                    return lastDotIndex > 0 && lastDotIndex < name.length() - 1 ?
                            name.substring(lastDotIndex) : null;
                });
    }

    private Optional<String> getExtensionFromFormat(String format) {
        return Optional.ofNullable(format)
                .filter(f -> !f.isBlank())
                .map(f -> f.toLowerCase().trim())
                .flatMap(this::findExtensionForFormat);
    }

    private Optional<String> findExtensionForFormat(String format) {
        return Optional.ofNullable(FORMAT_EXTENSION_MAP.get(format.toLowerCase()))
                .or(() ->
                        FORMAT_EXTENSION_MAP.entrySet().stream()
                                .filter(entry -> format.toLowerCase().contains(entry.getKey()))
                                .findFirst()
                                .map(Map.Entry::getValue)
                );
    }

    private String formatAudioInfo(AudioInfoEntity audio) {
        StringBuilder audioBuilder = new StringBuilder();

        // Language
        String language = audio.getLanguage();
        if (language != null && !language.isBlank() && !"und".equals(language)) {
            spokenLanguageRepository.findById(language).ifPresentOrElse(
                    spokenLanguageEntity -> {
                        if(spokenLanguageEntity.getEnglish_name() != null && !spokenLanguageEntity.getEnglish_name().isBlank()){
                            audioBuilder.append(spokenLanguageEntity.getEnglish_name()).append(" ");
                        }else{
                            audioBuilder.append(language.toUpperCase()).append(" ");
                        }
                    }, () -> audioBuilder.append(language.toUpperCase()).append(" ")
            );
        }

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
}