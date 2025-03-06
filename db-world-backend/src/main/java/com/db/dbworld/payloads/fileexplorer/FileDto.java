package com.db.dbworld.payloads.fileexplorer;


import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.Date;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
public class FileDto {

    private UUID id;
    private String fileName;
    private String filePath;
    private String parentFolder;
    private String fileSize;
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", timezone = "UTC")
    private Date creationTime;
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", timezone = "UTC")
    private Date lastModifiedTime;
    private boolean isDirectory;

    public FileDto(Path path) throws IOException {
        this.fileName = path.getFileName().toString();
        this.filePath = path.toAbsolutePath().toString();
        this.parentFolder = path.getParent().toString();
        this.fileSize = String.valueOf(Files.size(path));
        this.isDirectory  = path.toFile().isDirectory();

        BasicFileAttributes attrs = Files.readAttributes(path, BasicFileAttributes.class);
        this.creationTime = new Date(attrs.creationTime().toMillis());
        this.lastModifiedTime = new Date(attrs.lastModifiedTime().toMillis());
    }

}
