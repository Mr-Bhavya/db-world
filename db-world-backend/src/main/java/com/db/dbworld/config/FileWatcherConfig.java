//package com.db.dbworld.config;
//
//import com.db.dbworld.handler.MediaFileHandler;
//import com.db.dbworld.utils.DbWorldRuntimeProperties;
//import org.springframework.context.annotation.Bean;
//import org.springframework.context.annotation.Configuration;
//import org.springframework.integration.dsl.IntegrationFlow;
//import org.springframework.integration.file.FileReadingMessageSource;
//import org.springframework.integration.file.dsl.Files;
//
//@Configuration
//public class FileWatcherConfig {
//
//    @Bean
//    IntegrationFlow integrationFolderFlow(MediaFileHandler handler,
//                                          DbWorldRuntimeProperties props) {
//
//        return IntegrationFlow
//                .from(Files.inboundAdapter(props.getIntegrationPath().toFile())
//                        .autoCreateDirectory(true)
//                        .preventDuplicates(true)
//                        .useWatchService(true)
//                        .watchEvents(
//                                FileReadingMessageSource.WatchEventType.CREATE,
//                                FileReadingMessageSource.WatchEventType.MODIFY,
//                                FileReadingMessageSource.WatchEventType.DELETE))
//                .handle(handler, "processFile")
//                .get();
//    }
//}
//
