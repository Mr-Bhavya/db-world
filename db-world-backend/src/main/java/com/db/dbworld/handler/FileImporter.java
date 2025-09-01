package com.db.dbworld.handler;

import com.db.dbworld.dao.fileexplorer.FileRepository;
import com.db.dbworld.entities.fileexplorer.FileEntity;
import com.db.dbworld.exceptions.DbWorldException;
import com.db.dbworld.payloads.fileexplorer.FileDto;
import com.db.dbworld.utils.DbWorldConstants;
import jakarta.annotation.PostConstruct;
import lombok.extern.log4j.Log4j2;
import org.modelmapper.ModelMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.stream.Stream;

@Log4j2
@Component
public class FileImporter {

    @Value("${app.stream-path}")
    private final String baseDirectory = DbWorldConstants.STREAM_HOME_PATH;

    @Autowired
    private ModelMapper modelMapper;

    private final FileRepository fileRepository;

    public FileImporter(FileRepository fileRepository) {
        this.fileRepository = fileRepository;
    }

    @PostConstruct
    public void importFiles() throws IOException {
        Path basePath = Paths.get(baseDirectory);
        if (!Files.exists(basePath)) {
            log.error("Base directory does not exist: {}", baseDirectory);
            return;
        }
        try (Stream<Path> paths = Files.walk(basePath)) {
            paths.forEach(path -> {
                String absolutePath = path.toAbsolutePath().toString();
                // Import only if not already present in the DB
                if (fileRepository.findAll().stream()
                        .noneMatch(entity -> entity.getFilePath().equals(absolutePath))) {
                    try {
                        FileDto fileDto = new FileDto(path);
                        FileEntity fileEntity = modelMapper.map(fileDto, FileEntity.class);
                        fileRepository.save(fileEntity);
                        log.info("Imported file: {}", absolutePath);
                    } catch (Exception e) {
                        log.error(e.getMessage());
//                        throw new DbWorldException(e.getMessage(), e);
                    }
                }
            });
        }
    }
}
