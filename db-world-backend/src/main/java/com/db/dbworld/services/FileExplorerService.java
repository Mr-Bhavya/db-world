package com.db.dbworld.services;

import com.db.dbworld.dao.fileexplorer.FileRepository;
import com.db.dbworld.entities.fileexplorer.FileEntity;
import com.db.dbworld.payloads.fileexplorer.FileDto;
import com.db.dbworld.utils.DbWorldConstants;
import org.modelmapper.ModelMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.*;
import java.util.List;
import java.util.UUID;

@Service
public class FileExplorerService {

    @Autowired
    private ModelMapper modelMapper;

    private final FileRepository fileRepository;

    public FileExplorerService(FileRepository fileRepository) {
        this.fileRepository = fileRepository;
    }

    // Retrieve file metadata by its ID.
    public FileEntity getFile(UUID id) {
        return fileRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("File not found"));
    }

    // Rename file on disk and update metadata.
    public void renameFile(UUID id, String newName) throws IOException {
        FileEntity fileEntity = getFile(id);
        Path oldPath = Paths.get(fileEntity.getFilePath());
        Path newPath = oldPath.resolveSibling(newName);
        Files.move(oldPath, newPath, StandardCopyOption.REPLACE_EXISTING);
    }

    // Move file to a new relative directory and update metadata.
    public void moveFile(UUID id, String newRelativeDirectory) throws IOException {
        FileEntity fileEntity = getFile(id);
        Path oldPath = Paths.get(fileEntity.getFilePath());
        Path targetDir = Paths.get(DbWorldConstants.STREAM_HOME_PATH, newRelativeDirectory);
//        Files.createDirectories(targetDir);
        Path newPath = targetDir.resolve(fileEntity.getFileName());
        Files.move(oldPath, newPath, StandardCopyOption.REPLACE_EXISTING);
//        fileRepository.delete(fileEntity);
//        fileRepository.save(this.modelMapper.map(new FileDto(newPath), FileEntity.class));
    }

    // Copy file and create a new metadata record.
    public void copyFile(UUID id, String destinationRelativeDirectory) throws IOException {
        FileEntity sourceEntity = getFile(id);
        Path sourcePath = Paths.get(sourceEntity.getFilePath());
        Path targetDir = Paths.get(DbWorldConstants.STREAM_HOME_PATH, destinationRelativeDirectory);
        Files.createDirectories(targetDir);
        Path targetPath = targetDir.resolve(sourceEntity.getFileName());
        Files.copy(sourcePath, targetPath, StandardCopyOption.REPLACE_EXISTING);
//        FileDto fileDto = new FileDto(targetPath);
//        return fileRepository.save(modelMapper.map(fileDto, FileEntity.class));
    }

    // Delete file from disk and remove metadata.
    public void deleteFile(UUID id) throws IOException {
        FileEntity fileEntity = getFile(id);
        Path path = Paths.get(fileEntity.getFilePath());
        Files.deleteIfExists(path);
//        fileRepository.delete(fileEntity);
    }

    // List files in a given relative directory.
    public List<FileDto> listFiles(String relativeDirectory) {
        Path dirPath = Paths.get(DbWorldConstants.STREAM_HOME_PATH, relativeDirectory).toAbsolutePath();
        return fileRepository.findByParentFolder(dirPath.toString()).stream().map(fileEntity ->
                this.modelMapper.map(fileEntity, FileDto.class))
                .peek(fileDto -> fileDto.setFilePath(fileDto.getFilePath()
                        .replace("\\", "/")
                        .replace(DbWorldConstants.STREAM_HOME_PATH.replace("\\", "/"), "")))
                .toList();
    }

    // Save a new file from a MultipartFile.
    public FileEntity saveNewFile(String fileName, String relativeDirectory, MultipartFile file) throws IOException {
        Path dirPath = Paths.get(DbWorldConstants.STREAM_HOME_PATH, relativeDirectory);
        Files.createDirectories(dirPath);
        Path filePath = dirPath.resolve(fileName);
        Files.write(filePath, file.getBytes(), StandardOpenOption.CREATE);
        FileDto fileDto = new FileDto(filePath);
        return fileRepository.save(modelMapper.map(fileDto, FileEntity.class));
    }
}
