package com.db.dbworld.utils;

import com.db.dbworld.dao.dbcinema.tmdb.SpokenLanguageRepository;
import com.db.dbworld.entities.dbcinema.DBCinemaRecordsEntity;
import com.db.dbworld.entities.dbcinema.stream.AudioInfoEntity;
import com.db.dbworld.entities.dbcinema.stream.GeneralInfoEntity;
import com.db.dbworld.entities.dbcinema.stream.MediaFileInfoEntity;
import com.db.dbworld.entities.dbcinema.stream.VideoInfoEntity;
import com.db.dbworld.entities.dbcinema.tmdb.MovieTmdbDataEntity;
import com.db.dbworld.entities.dbcinema.tmdb.SeriesTmdbDataEntity;
import com.db.dbworld.exceptions.DbWorldException;
import com.db.dbworld.payloads.mediafile.MediaFileDetails;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.gson.Gson;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Log4j2
@Service
public class MediaInfoUtils {

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

    @Autowired
    private SpokenLanguageRepository spokenLanguageRepository;

    @Autowired
    private ObjectMapper objectMapper;

    public String buildFileNameAndPath(MediaFileDetails fileDetails, MediaFileInfoEntity mediaFileInfoEntity) {
        StringBuilder fileNameBuilder = new StringBuilder();
        DBCinemaRecordsEntity dbCinemaRecordsEntity = fileDetails.getDbCinemaRecordsEntity();
        String recordType = dbCinemaRecordsEntity.getType();

        if (DbWorldConstants.RECORD_TYE.MOVIE.name().equalsIgnoreCase(recordType)) {
            buildMovieFileName(fileNameBuilder, fileDetails, mediaFileInfoEntity);
        } else if (DbWorldConstants.RECORD_TYE.SERIES.name().equalsIgnoreCase(recordType)) {
            buildSeriesFileName(fileDetails, fileNameBuilder, mediaFileInfoEntity);
        }

        appendFileExtension(fileNameBuilder, fileDetails, mediaFileInfoEntity);
        return PathSanitizer.sanitizeFilename(fileNameBuilder.toString());
    }

    public String buildFileNameAndPath(MediaFileDetails fileDetails, String json) {
        MediaFileInfoEntity mediaFileInfoEntity = parseMediaInfoJson(fileDetails, json).get(0);
        return buildFileNameAndPath(fileDetails, mediaFileInfoEntity);
    }

    public void buildMovieFileName(StringBuilder fileNameBuilder, MediaFileDetails fileDetails, MediaFileInfoEntity entity) {
        fileNameBuilder.append(fileDetails.getName());
        appendVideoInfo(fileNameBuilder, entity, fileDetails);
        appendAudioInfo(fileNameBuilder, entity);
    }

    public void buildSeriesFileName(MediaFileDetails fileDetails, StringBuilder fileNameBuilder,
                                    MediaFileInfoEntity entity) {
        fileNameBuilder.append(fileDetails.getName())
                .append(" ").append(fileDetails.getSeason()).append(fileDetails.getEpisode());
        appendVideoInfo(fileNameBuilder, entity, fileDetails);
        appendAudioInfo(fileNameBuilder, entity);
    }

    private void appendVideoInfo(StringBuilder fileNameBuilder, MediaFileInfoEntity entity, MediaFileDetails fileDetails) {

        if(!fileDetails.getYear().isEmpty()){
            fileNameBuilder.append(" (").append(fileDetails.getYear()).append(")");
        }

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

    public String getYearInfo(DBCinemaRecordsEntity dbCinemaRecordsEntity) {
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

    public void appendBitInfo(StringBuilder fileNameBuilder, VideoInfoEntity videoInfo) {
        Integer bitDepth = videoInfo.getBitDepth();
        if (bitDepth != null) {
            if (bitDepth == 10) {
                fileNameBuilder.append(" [10Bit]");
            } else if (bitDepth == 12) {
                fileNameBuilder.append(" [12Bit]");
            } else if (bitDepth == 8) {
                fileNameBuilder.append(" [8Bit]");
            }
        }
    }

    public void appendResolutionInfo(StringBuilder fileNameBuilder, VideoInfoEntity videoInfo) {
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

    public void appendCodecInfo(StringBuilder fileNameBuilder, VideoInfoEntity videoInfo) {
        String format = videoInfo.getFormat().toUpperCase();
        String formatDisplayName = switch (format) {
            case "HEVC" -> "H265";
            case "AVC" -> "H264";
            case "AV1" -> "AV1";
            default -> format;
        };
        fileNameBuilder.append(" [").append(formatDisplayName).append("]");
    }

    public Optional<VideoInfoEntity> getFirstVideoTrack(MediaFileInfoEntity entity) {
        return entity.getTrackInfos().stream()
                .filter(VideoInfoEntity.class::isInstance)
                .map(VideoInfoEntity.class::cast)
                .findFirst();
    }

    public void appendHdrInfo(StringBuilder fileNameBuilder, VideoInfoEntity videoInfo) {
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

    public void appendAudioInfo(StringBuilder fileNameBuilder, MediaFileInfoEntity entity) {
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

    public List<AudioInfoEntity> getAudioTracks(MediaFileInfoEntity entity) {
        return entity.getTrackInfos().stream()
                .filter(AudioInfoEntity.class::isInstance)
                .map(AudioInfoEntity.class::cast)
                .collect(Collectors.toList());
    }

    public void appendFileExtension(StringBuilder fileNameBuilder, MediaFileDetails fileDetails, MediaFileInfoEntity mediaFileInfo) {
        Optional.ofNullable(mediaFileInfo)
                .flatMap(this::getExtensionFromMediaFileInfo)
                .or(() -> Optional.ofNullable(fileDetails)
                        .map(MediaFileDetails::getStreamFilePath)
                        .flatMap(this::getExtensionFromFileName))
                .ifPresent(fileNameBuilder::append);
    }

    public Optional<String> getExtensionFromMediaFileInfo(MediaFileInfoEntity mediaFileInfo) {
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

    public Optional<String> getExtensionFromFileName(String fileName) {
        return Optional.ofNullable(fileName)
                .filter(name -> name.contains("."))
                .map(name -> {
                    int lastDotIndex = name.lastIndexOf('.');
                    return lastDotIndex > 0 && lastDotIndex < name.length() - 1 ?
                            name.substring(lastDotIndex) : null;
                });
    }

    public Optional<String> getExtensionFromFormat(String format) {
        return Optional.ofNullable(format)
                .filter(f -> !f.isBlank())
                .map(f -> f.toLowerCase().trim())
                .flatMap(this::findExtensionForFormat);
    }

    public Optional<String> findExtensionForFormat(String format) {
        return Optional.ofNullable(FORMAT_EXTENSION_MAP.get(format.toLowerCase()))
                .or(() ->
                        FORMAT_EXTENSION_MAP.entrySet().stream()
                                .filter(entry -> format.toLowerCase().contains(entry.getKey()))
                                .findFirst()
                                .map(Map.Entry::getValue)
                );
    }

    public String formatAudioInfo(AudioInfoEntity audio) {
        StringBuilder audioBuilder = new StringBuilder();

        // Language
        String language = audio.getLanguage();
        if (language != null && !language.isBlank() && !"und".equals(language)) {
            spokenLanguageRepository.findById(language).ifPresentOrElse(
                    spokenLanguageEntity -> {
                        if (spokenLanguageEntity.getEnglish_name() != null && !spokenLanguageEntity.getEnglish_name().isBlank()) {
                            audioBuilder.append(spokenLanguageEntity.getEnglish_name()).append(" ");
                        } else {
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

    public List<MediaFileInfoEntity> parseMediaInfoJson(MediaFileDetails fileDetails, String jsonOutput) {
        log.debug("MediaInfo Json: {}", jsonOutput);
        try {
            JsonElement jsonElement = new Gson().fromJson(jsonOutput, JsonElement.class);
            List<MediaFileInfoEntity> mediaFileInfos = new ArrayList<>();

            if (jsonElement.isJsonArray()) {
                jsonElement.getAsJsonArray().forEach(element ->
                        mediaFileInfos.add(jsonObjectToMediaFileInfoEntity(fileDetails, element.getAsJsonObject())));
            } else if (jsonElement.isJsonObject()) {
                mediaFileInfos.add(jsonObjectToMediaFileInfoEntity(fileDetails, jsonElement.getAsJsonObject()));
            }

            return mediaFileInfos.stream().peek(mediaFileInfo -> mediaFileInfo.initialize(fileDetails.getDbCinemaRecordsEntity())).toList();
        } catch (Exception ex) {
            throw new DbWorldException("Error parsing media info JSON", ex);
        }
    }

    private MediaFileInfoEntity jsonObjectToMediaFileInfoEntity(MediaFileDetails fileDetails, JsonObject jsonObject) {
        try {
            MediaFileInfoEntity entity = convertJsonObjectToMediaInfo(jsonObject);
            if (fileDetails.getRecordId() != null) {
                entity = entity.initialize(fileDetails.getDbCinemaRecordsEntity());
            }
            return entity;
        } catch (Exception e) {
            log.error("Error parsing media info JSON for recordId: {}, {}", fileDetails.getRecordId(), e.getMessage());
            throw new DbWorldException("Error parsing media info JSON for recordId: " + fileDetails.getRecordId(), e);
        }
    }

    private MediaFileInfoEntity convertJsonObjectToMediaInfo(JsonObject jsonObject) throws JsonProcessingException {
        MediaFileInfoEntity mediaFileInfo = objectMapper.readValue(jsonObject.get("media").toString(), MediaFileInfoEntity.class);
        if (mediaFileInfo == null) {
            throw new DbWorldException("Media file details could not be retrieved from JSON");
        }
        return mediaFileInfo;
    }

}
