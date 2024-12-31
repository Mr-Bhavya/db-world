package com.db.dbworld.config;

import com.db.dbworld.dao.dbcinema.stream.MediaFileInfoRepository;
import com.db.dbworld.dao.dbcinema.stream.TrackInfoRepository;
import com.db.dbworld.entities.dbcinema.stream.MediaFileInfoEntity;
import com.db.dbworld.exceptions.DbWorldException;
import com.db.dbworld.services.DBCinemaRecordsService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.gson.Gson;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.integration.annotation.ServiceActivator;
import org.springframework.integration.channel.DirectChannel;
import org.springframework.integration.core.MessageSource;
import org.springframework.integration.dsl.IntegrationFlow;
import org.springframework.integration.dsl.Pollers;
import org.springframework.integration.file.FileReadingMessageSource;
import org.springframework.integration.file.filters.AcceptAllFileListFilter;
import org.springframework.integration.file.filters.CompositeFileListFilter;
import org.springframework.integration.file.filters.FileSystemPersistentAcceptOnceFileListFilter;
import org.springframework.integration.metadata.SimpleMetadataStore;
import org.springframework.integration.scheduling.PollerMetadata;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessageHandler;

import java.io.BufferedReader;
import java.io.File;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedList;
import java.util.List;

@Log4j2
@Configuration
public class FilePollingConfig {

//    @Value("${dbworld.paths.streamHomePath}")
    private String INPUT_DIRECTORY = "D:/Bhavya/ProcessedVideos";


    @Autowired
    private DBCinemaRecordsService dbCinemaRecordsService;

    @Autowired
    private MediaFileInfoRepository mediaFileInfoRepository;

    @Autowired
    private TrackInfoRepository trackInfoRepository;

    /**
     * Configures the file-reading message source.
     */
    @Bean
    public MessageSource<File> fileReadingMessageSource() {
        FileReadingMessageSource source = new FileReadingMessageSource();
        source.setDirectory(new File(INPUT_DIRECTORY));
        source.setFilter(new CompositeFileListFilter<>(
                List.of(new AcceptAllFileListFilter<>(),
                        new FileSystemPersistentAcceptOnceFileListFilter(new SimpleMetadataStore(), "file-metadata-"))
        ));
//        source.setLocker(new NioFileLocker());
        source.setScanEachPoll(true);

        // Configure filters
//        CompositeFileListFilter<File> filters = new CompositeFileListFilter<>();
//        filters.addFilter(new SimplePatternFileListFilter("*.*")); // Only .txt files
//        filters.addFilter(new AcceptOnceFileListFilter<>()); // Prevent processing the same file multiple times
//        source.setFilter(filters);

        return source;
    }

    /**
     * Configures the input channel for file events.
     */
    @Bean
    public MessageChannel fileInputChannel() {
        return new DirectChannel();
    }

    /**
     * Configures the message handler for processing files.
     */
    @Bean
    @ServiceActivator(inputChannel = "fileInputChannel")
    public MessageHandler fileMessageHandler() {
        return message -> {
            File file = (File) message.getPayload();
            System.out.println("New file detected: " + file.getAbsolutePath());
        };
    }

    /**
     * Configures the polling interval.
     */
    @Bean(name = PollerMetadata.DEFAULT_POLLER)
    public PollerMetadata poller() {
        return Pollers.fixedDelay(1000).getObject(); // Poll every 5 seconds
    }

    @Bean
    public IntegrationFlow fileIntegrationFlow() {
        return IntegrationFlow
                .from(fileReadingMessageSource())
//                .handle(message -> {
//                    System.out.println("File detected: " + message.getPayload());
//                })
                .handle(file -> {
                    File originalFile = (File) file.getPayload();
                    log.info("Processing File: {}", originalFile.toString());
                    try {
                        List<MediaFileInfoEntity> mediaFileInfoEntities = storeMediaInfo(originalFile.toPath());
                        log.info("Total files processed - {}", mediaFileInfoEntities.size());
                    } catch (Exception e) {
                        log.error(e.getMessage());
                    }
                    log.info("File processed: {}", originalFile.toString());
                })
                .get();
    }

    private List<MediaFileInfoEntity> storeMediaInfo(Path path) throws IOException, InterruptedException {
        try {
            Long recordId = Long.parseLong(path.getFileName().toString().split("-")[0]);

            LinkedList<String> list = new LinkedList<>();
            list.add("D:\\Bhavya\\Downloads\\Compressed\\MediaInfo_CLI_24.12_Windows_x64\\mediainfo");
            list.add("--Output=JSON");
            list.add(path.toString());
            // Run mediainfo command
            ProcessBuilder processBuilder = new ProcessBuilder();
            processBuilder.command(list);
            Process process = processBuilder.start();
            BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()));
            StringBuilder output = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                output.append(line);
            }
            process.waitFor();
            List<MediaFileInfoEntity> mediaFileInfos = new ArrayList<>();

            JsonElement outputJsonElement = new Gson().fromJson(output.toString(), JsonElement.class);
            if (outputJsonElement.isJsonArray()) {
                outputJsonElement.getAsJsonArray().asList().forEach(
                        jsonElement -> {
                            if (jsonElement.isJsonObject()) {
                                MediaFileInfoEntity mediaFileInfo = null;
                                try {
                                    mediaFileInfo = convertJsonObjectToMediaInfo(jsonElement.getAsJsonObject());
                                    mediaFileInfoRepository.save(mediaFileInfo.initialize(dbCinemaRecordsService.getRecordEntityById(recordId)));
                                } catch (Exception e) {
                                    throw new DbWorldException(e.getMessage());
                                }
                            }
                        }
                );
            } else if (outputJsonElement.isJsonObject()) {
                MediaFileInfoEntity mediaFileInfo = convertJsonObjectToMediaInfo(outputJsonElement.getAsJsonObject());
                mediaFileInfoRepository.save(mediaFileInfo.initialize(dbCinemaRecordsService.getRecordEntityById(recordId)));
            }
            return mediaFileInfos;
        }catch (Exception ex){
            throw new DbWorldException(ex.getMessage());
        }
    }

    private MediaFileInfoEntity convertJsonObjectToMediaInfo(JsonObject jsonObject) throws JsonProcessingException {
        String media = jsonObject.get("media").toString();
        ObjectMapper objectMapper = new ObjectMapper();
        objectMapper.configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
        MediaFileInfoEntity mediaFileInfo = objectMapper.readValue(media, MediaFileInfoEntity.class);
        if(mediaFileInfo == null){
            throw new DbWorldException("Not able to fetch details for media file");
        }
        return mediaFileInfo;
    }

}

